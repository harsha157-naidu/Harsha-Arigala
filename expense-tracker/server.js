const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database connected successfully.');
    createTables();
  }
});

// Helper to run database queries as Promises
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Create tables if they do not exist
async function createTables() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS states (
        user_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Database tables verified/created successfully.');

    // Seed default profiles if empty
    const userCountRow = await dbGet('SELECT COUNT(*) as count FROM users');
    if (userCountRow.count === 0) {
      console.log('Pre-seeding default profile accounts (john, jane, alex) in SQLite database...');
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('password', salt);
      
      const seedUsers = [
        { id: 'user-john', username: 'john', password: passwordHash },
        { id: 'user-jane', username: 'jane', password: passwordHash },
        { id: 'user-alex', username: 'alex', password: passwordHash }
      ];
      
      for (const u of seedUsers) {
        await dbRun('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [u.id, u.username, u.password]);
        await dbRun('INSERT INTO states (user_id, state_json) VALUES (?, ?)', [u.id, JSON.stringify(getDefaultState())]);
      }
      
      // Seed john with demo transactions as well
      const johnDemoState = getDefaultState();
      const formatOffsetDate = (offsetDays) => {
        const d = new Date();
        d.setDate(new Date().getDate() - offsetDays);
        return d.toISOString().split('T')[0];
      };
      johnDemoState.transactions = [
        { id: 'tx-demo-1', type: 'income', amount: 125000.00, date: formatOffsetDate(12), category: 'cat-salary', description: 'Monthly Salary Paycheck', notes: 'Direct deposit primary job' },
        { id: 'tx-demo-2', type: 'income', amount: 8500.00, date: formatOffsetDate(5), category: 'cat-investments', description: 'Dividend Payout', notes: 'Mutual fund returns' },
        { id: 'tx-demo-3', type: 'expense', amount: 2800.00, date: formatOffsetDate(1), category: 'cat-utilities', description: 'Electricity Bill', notes: 'Autopay energy' },
        { id: 'tx-demo-4', type: 'expense', amount: 25000.00, date: formatOffsetDate(10), category: 'cat-housing', description: 'Monthly House Rent', notes: '2BHK Apartment' },
        { id: 'tx-demo-5', type: 'expense', amount: 1250.00, date: formatOffsetDate(2), category: 'cat-food', description: 'Dinner at Restaurant', notes: 'Dinner with friends' }
      ];
      await dbRun('UPDATE states SET state_json = ? WHERE user_id = ?', [JSON.stringify(johnDemoState), 'user-john']);
      console.log('Default profiles (john, jane, alex) successfully pre-seeded in SQLite database.');
    }
  } catch (err) {
    console.error('Error creating database tables:', err);
  }
}

// Default state structure for a newly registered user
const getDefaultState = () => {
  const DEFAULT_CATEGORIES = [
    { id: 'cat-salary', name: 'Salary', icon: '💰', color: 142, type: 'income' },
    { id: 'cat-investments', name: 'Investments', icon: '📈', color: 200, type: 'income' },
    { id: 'cat-food', name: 'Food & Dining', icon: '🍔', color: 38, type: 'expense' },
    { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', color: 346, type: 'expense' },
    { id: 'cat-utilities', name: 'Utilities & Bills', icon: '⚡', color: 220, type: 'expense' },
    { id: 'cat-entertainment', name: 'Entertainment', icon: '🎬', color: 280, type: 'expense' },
    { id: 'cat-transport', name: 'Transport', icon: '🚗', color: 180, type: 'expense' },
    { id: 'cat-health', name: 'Health & Medical', icon: '🏥', color: 0, type: 'expense' },
    { id: 'cat-housing', name: 'Housing & Rent', icon: '🏠', color: 25, type: 'expense' },
    { id: 'cat-other', name: 'Other / Misc', icon: '🏷️', color: 60, type: 'expense' }
  ];

  const DEFAULT_BUDGETS = {
    'cat-food': 15000,
    'cat-shopping': 10000,
    'cat-utilities': 6000,
    'cat-entertainment': 5000,
    'cat-transport': 4000
  };

  return {
    transactions: [],
    budgets: DEFAULT_BUDGETS,
    categories: DEFAULT_CATEGORIES,
    theme: 'light',
    activeView: 'view-dashboard'
  };
};

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing.' });
  }

  // Token is passed as 'Bearer <userId>' for simple validation
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid token format. Expected Bearer <userId>.' });
  }

  const userId = parts[1];
  try {
    const user = await dbGet('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(401).json({ error: 'User does not exist or invalid session.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication internal server error.' });
  }
};

// --- AUTHENTICATION ROUTES ---

// Registration
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  const normalizedUsername = username.trim().toLowerCase();

  try {
    // Check if user already exists
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Create user and hash password
    const userId = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    await dbRun('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [
      userId,
      normalizedUsername,
      passwordHash
    ]);

    // Create default initial state
    const initialState = getDefaultState();
    await dbRun('INSERT INTO states (user_id, state_json) VALUES (?, ?)', [
      userId,
      JSON.stringify(initialState)
    ]);

    res.status(201).json({
      userId: userId,
      username: username.trim()
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register new account.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const normalizedUsername = username.trim().toLowerCase();

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [normalizedUsername]);
    if (!user) {
      return res.status(404).json({ error: 'Account does not exist. Please register first.' });
    }

    const isPasswordMatch = bcrypt.compareSync(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    res.status(200).json({
      userId: user.id,
      // Retrieve display name from DB or use capitalized string
      username: username.trim()
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// --- TRACKER STATE API ---

// Fetch State
app.get('/api/state', authenticateUser, async (req, res) => {
  try {
    const row = await dbGet('SELECT state_json FROM states WHERE user_id = ?', [req.user.id]);
    if (!row) {
      return res.status(404).json({ error: 'State not found for user.' });
    }
    const stateObj = JSON.parse(row.state_json);
    res.status(200).json(stateObj);
  } catch (err) {
    console.error('Fetch state error:', err);
    res.status(500).json({ error: 'Failed to retrieve ledger data.' });
  }
});

// Update/Save State
app.post('/api/state', authenticateUser, async (req, res) => {
  const { state } = req.body;

  if (!state) {
    return res.status(400).json({ error: 'State object is required.' });
  }

  try {
    await dbRun(
      'INSERT INTO states (user_id, state_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP',
      [req.user.id, JSON.stringify(state)]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Save state error:', err);
    res.status(500).json({ error: 'Failed to sync ledger data to database.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
