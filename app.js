/**
 * Monthly Expenses - Personal Expense Tracker & Budget Planner
 * Pure JavaScript App Logic & State Controller
 */

// --- Constants & Configuration ---
const STORAGE_KEY = 'monthly_expenses_db';
const MIGRATION_OLD_KEY = 'apex_ledger_db';

// Preset Colors (Hues in HSL color space)
const PRESET_HUES = [250, 142, 346, 38, 200, 280, 180, 0, 310, 80];

// Default Category Definitions
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

// Default Budgets for Expense Categories
const DEFAULT_BUDGETS = {
    'cat-food': 15000,
    'cat-shopping': 10000,
    'cat-utilities': 6000,
    'cat-entertainment': 5000,
    'cat-transport': 4000
};

// --- Application State ---
let state = {
    transactions: [],
    budgets: { ...DEFAULT_BUDGETS },
    categories: [...DEFAULT_CATEGORIES],
    theme: 'light',
    language: 'en',
    activeView: 'view-dashboard'
};

// Current User state variable
let currentUser = '';

// --- Initialization ---
// --- Initialization ---
let API_URL = localStorage.getItem('monthly_expenses_api_url') || 'http://localhost:3000/api';

// Fetch options helper
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser}`
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load current session
    currentUser = localStorage.getItem('monthly_expenses_current_user') || '';

    if (currentUser) {
        document.body.className = 'logged-in';
        await loadStateFromStorage();
        updateUserProfileUI();
        applyTheme(state.theme);
        setCurrentDate();
        navigate(state.activeView);
        renderAll();
    } else {
        currentUser = '';
        localStorage.removeItem('monthly_expenses_current_user');
        localStorage.removeItem('monthly_expenses_username');
        document.body.className = 'logged-out';
        applyTheme('light'); // default theme for auth page
    }

    setupEventListeners();
    initGoogleTranslate();
});

// --- State Management ---
async function saveStateToStorage() {
    if (!currentUser) return;

    // Backup locally first
    localStorage.setItem(STORAGE_KEY + '_' + currentUser, JSON.stringify(state));

    try {
        const res = await fetch(`${API_URL}/state`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ state })
        });
        if (!res.ok) {
            console.warn('Failed to sync state to server.');
        }
    } catch (err) {
        console.error('Error syncing state to server:', err);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Navigation Menu (Sidebar & Mobile)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetView = item.getAttribute('data-target');
            navigate(targetView);
        });
    });

    // Theme Toggles
    document.getElementById('theme-light').addEventListener('click', () => applyTheme('light'));
    document.getElementById('theme-dark').addEventListener('click', () => applyTheme('dark'));

    // Quick Action Buttons
    document.getElementById('btn-add-tx').addEventListener('click', () => openTransactionModal());
    document.getElementById('btn-see-all-tx').addEventListener('click', () => navigate('view-transactions'));

    const loadDemoBtn = document.getElementById('btn-load-demo');
    if (loadDemoBtn) {
        loadDemoBtn.addEventListener('click', () => loadDemoData(true));
    }

    document.getElementById('btn-download-txs').addEventListener('click', exportLedgerPDF);

    // Transaction Modal Closures
    document.getElementById('btn-close-tx-modal').addEventListener('click', closeTransactionModal);
    document.getElementById('btn-cancel-tx').addEventListener('click', closeTransactionModal);

    // Transaction Modal Type Segment changes
    const txTypeRadios = document.querySelectorAll('input[name="tx-type"]');
    txTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const editId = document.getElementById('tx-edit-id').value;
            updateCategoryDropdown(e.target.value);
            updateSubmitButtonText(e.target.value, !!editId);
        });
    });


    // Transaction Modal Submit Form
    document.getElementById('form-transaction').addEventListener('submit', handleTransactionSubmit);

    // Budget Modal Closures
    document.getElementById('btn-close-budget-modal').addEventListener('click', closeBudgetModal);
    document.getElementById('btn-cancel-budget').addEventListener('click', closeBudgetModal);
    document.getElementById('form-budget').addEventListener('submit', handleBudgetSubmit);

    // Filters Event Listeners
    document.getElementById('filter-search').addEventListener('input', renderLedger);
    document.getElementById('filter-type').addEventListener('change', renderLedger);
    document.getElementById('filter-category').addEventListener('change', renderLedger);
    document.getElementById('btn-filter-reset').addEventListener('click', resetFilters);

    // Custom Category Creation Form
    document.getElementById('form-add-category').addEventListener('submit', handleAddCategorySubmit);

    // Data Integration Backups
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportDatabaseJSON);
    }

    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportLedgerPDF);
    }

    const importJsonInput = document.getElementById('input-import-json');
    if (importJsonInput) {
        importJsonInput.addEventListener('change', importDatabaseJSON);
    }

    const wipeDataBtn = document.getElementById('btn-wipe-data');
    if (wipeDataBtn) {
        wipeDataBtn.addEventListener('click', handleHardReset);
    }




    // Authentication screen listeners
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.classList.add('active');
        formRegister.classList.remove('active');
        document.getElementById('login-error').style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.classList.add('active');
        formLogin.classList.remove('active');
        document.getElementById('register-error').style.display = 'none';
    });

    formLogin.addEventListener('submit', handleLoginSubmit);
    formRegister.addEventListener('submit', handleRegisterSubmit);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const logoutBtnMobile = document.getElementById('btn-logout-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', handleLogout);
    }

    const profileSelect = document.getElementById('select-switch-profile');
    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            const selectedUserId = e.target.value;
            const accounts = JSON.parse(localStorage.getItem('monthly_expenses_accounts') || '{}');
            const targetAcc = Object.values(accounts).find(acc => acc.userId === selectedUserId);
            if (targetAcc) {
                switchUserProfile(targetAcc.userId, targetAcc.username);
            }
        });
    }

    // Language selector triggers
    const sidebarLanguageSelect = document.getElementById('sidebar-language-select');
    if (sidebarLanguageSelect) {
        sidebarLanguageSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }

    const settingsLanguageSelect = document.getElementById('custom-language-select');
    if (settingsLanguageSelect) {
        settingsLanguageSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }
}

// --- Authentication Controllers ---
async function handleLoginSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!usernameInput || !passwordInput) {
        errorDiv.innerText = 'Please enter both username and password.';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (!response.ok) {
            errorDiv.innerText = data.error || 'Failed to log in.';
            errorDiv.style.display = 'block';
            return;
        }

        // Login successful
        currentUser = data.userId;
        localStorage.setItem('monthly_expenses_current_user', currentUser);
        localStorage.setItem('monthly_expenses_username', data.username);
        document.body.className = 'logged-in';

        await loadStateFromStorage();
        updateUserProfileUI();
        applyTheme(state.theme);
        renderAll();

        // Reset form
        document.getElementById('form-login').reset();
        errorDiv.style.display = 'none';
    } catch (err) {
        console.warn('Backend server connection failed. Attempting local offline login fallback:', err);

        // Check if user exists in local accounts
        const localAccounts = JSON.parse(localStorage.getItem('monthly_expenses_accounts') || '{}');
        const matchedAccount = Object.values(localAccounts).find(
            acc => acc.username.trim().toLowerCase() === usernameInput.toLowerCase()
        );

        if (matchedAccount && passwordInput === matchedAccount.password) {
            // Offline login successful
            currentUser = matchedAccount.userId;
            localStorage.setItem('monthly_expenses_current_user', currentUser);
            localStorage.setItem('monthly_expenses_username', matchedAccount.username);
            document.body.className = 'logged-in';

            await loadStateFromStorage();
            updateUserProfileUI();
            applyTheme(state.theme);
            renderAll();

            // Reset form
            document.getElementById('form-login').reset();
            errorDiv.style.display = 'none';
        } else {
            errorDiv.innerText = 'Unable to connect to server, and no matching offline credentials found.';
            errorDiv.style.display = 'block';
        }
    }
}

// --- User Registration & Login ---
async function handleRegisterSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('register-username').value.trim();
    const passwordInput = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');

    if (!usernameInput || !passwordInput) {
        errorDiv.innerText = 'Please enter a username and password.';
        errorDiv.style.display = 'block';
        return;
    }

    if (passwordInput.length < 4) {
        errorDiv.innerText = 'Password must be at least 4 characters long.';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (!response.ok) {
            errorDiv.innerText = data.error || 'Failed to register account.';
            errorDiv.style.display = 'block';
            return;
        }

        // Auto Login
        currentUser = data.userId;
        localStorage.setItem('monthly_expenses_current_user', currentUser);
        localStorage.setItem('monthly_expenses_username', data.username);
        document.body.className = 'logged-in';

        await loadStateFromStorage();
        updateUserProfileUI();
        applyTheme(state.theme);
        renderAll();

        // Reset form
        document.getElementById('form-register').reset();
        errorDiv.style.display = 'none';
    } catch (err) {
        console.warn('Backend server connection failed. Attempting local offline registration fallback:', err);

        const localAccounts = JSON.parse(localStorage.getItem('monthly_expenses_accounts') || '{}');
        const usernameKey = usernameInput.toLowerCase();

        if (localAccounts[usernameKey]) {
            errorDiv.innerText = 'Username is already taken locally.';
            errorDiv.style.display = 'block';
            return;
        }

        // Register locally
        const userId = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        localAccounts[usernameKey] = {
            username: usernameInput,
            password: passwordInput,
            userId: userId
        };
        localStorage.setItem('monthly_expenses_accounts', JSON.stringify(localAccounts));

        // Seed default state for new user
        const userStateKey = STORAGE_KEY + '_' + userId;
        const defaultState = {
            transactions: [],
            budgets: { ...DEFAULT_BUDGETS },
            categories: [...DEFAULT_CATEGORIES],
            theme: 'light',
            language: 'en',
            activeView: 'view-dashboard'
        };
        localStorage.setItem(userStateKey, JSON.stringify(defaultState));

        // Log in
        currentUser = userId;
        localStorage.setItem('monthly_expenses_current_user', currentUser);
        localStorage.setItem('monthly_expenses_username', usernameInput);
        document.body.className = 'logged-in';

        await loadStateFromStorage();
        updateUserProfileUI();
        applyTheme(state.theme);
        renderAll();

        document.getElementById('form-register').reset();
        errorDiv.style.display = 'none';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        saveStateToStorage();
        currentUser = '';
        localStorage.removeItem('monthly_expenses_current_user');
        localStorage.removeItem('monthly_expenses_username');
        document.body.className = 'logged-out';
    }
}

function updateUserProfileUI() {
    const avatar = document.getElementById('user-avatar');
    const greeting = document.getElementById('greeting-title');
    const sidebarUsername = document.getElementById('logged-in-username');
    const settingsUsername = document.getElementById('settings-profile-username');

    let name = localStorage.getItem('monthly_expenses_username') || 'User';

    if (avatar) {
        avatar.innerText = name.substring(0, 2).toUpperCase();
    }
    if (greeting) {
        greeting.innerText = `Hello, ${name}`;
    }
    if (sidebarUsername) {
        sidebarUsername.innerText = name;
    }
    if (settingsUsername) {
        settingsUsername.innerText = name;
    }

    populateProfileSwitcher();
}

function populateProfileSwitcher() {
    const select = document.getElementById('select-switch-profile');
    if (!select) return;

    select.innerHTML = '';

    const accounts = JSON.parse(localStorage.getItem('monthly_expenses_accounts') || '{}');

    Object.values(accounts).forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.userId;
        opt.textContent = acc.username;
        if (acc.userId === currentUser) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

async function switchUserProfile(newUserId, newUsername) {
    // 1. Save current state
    await saveStateToStorage();

    // 2. Switch current user
    currentUser = newUserId;
    localStorage.setItem('monthly_expenses_current_user', currentUser);
    localStorage.setItem('monthly_expenses_username', newUsername);

    // 3. Load state for the new user
    await loadStateFromStorage();

    // 4. Update UI
    updateUserProfileUI();
    applyTheme(state.theme);
    renderAll();

    // 5. Navigate to Dashboard
    navigate('view-dashboard');
}

// --- State Management Helpers ---
async function loadStateFromStorage() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_URL}/state`, {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            state = {
                transactions: data.transactions || [],
                budgets: data.budgets || { ...DEFAULT_BUDGETS },
                categories: data.categories || [...DEFAULT_CATEGORIES],
                theme: data.theme || 'light',
                language: data.language || 'en',
                activeView: data.activeView || 'view-dashboard'
            };
            // Backup locally
            localStorage.setItem(STORAGE_KEY + '_' + currentUser, JSON.stringify(state));
            return;
        }
    } catch (err) {
        console.error('Failed to load state from server, falling back to local storage:', err);
    }

    // Fallback to LocalStorage
    const stored = localStorage.getItem(STORAGE_KEY + '_' + currentUser);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            state = {
                transactions: parsed.transactions || [],
                budgets: parsed.budgets || { ...DEFAULT_BUDGETS },
                categories: parsed.categories || [...DEFAULT_CATEGORIES],
                theme: parsed.theme || 'light',
                language: parsed.language || 'en',
                activeView: parsed.activeView || 'view-dashboard'
            };
        } catch (e) {
            console.error('Failed to parse database state from localStorage, using defaults.', e);
        }
    } else {
        // If there is no stored data, initialize with default state
        state = {
            transactions: [],
            budgets: { ...DEFAULT_BUDGETS },
            categories: [...DEFAULT_CATEGORIES],
            theme: 'light',
            language: 'en',
            activeView: 'view-dashboard'
        };
        saveStateToStorage();
    }
}


// --- Navigation Controller ---
function navigate(viewId) {
    state.activeView = viewId;
    saveStateToStorage();

    // Deactivate all views and nav buttons
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    // Activate target panel
    const activePanel = document.getElementById(viewId);
    if (activePanel) {
        activePanel.classList.add('active');
    }

    // Update active states on both sidebar and mobile navigations
    document.querySelectorAll(`.nav-item[data-target="${viewId}"]`).forEach(btn => {
        btn.classList.add('active');
    });

    // View-specific initialization loads
    if (viewId === 'view-transactions') {
        populateCategoryFilter();
        renderLedger();
    } else if (viewId === 'view-budgets') {
        renderBudgets();
    } else if (viewId === 'view-analytics') {
        renderAnalytics();
    } else if (viewId === 'view-settings') {
        renderSettingsView();
    } else if (viewId === 'view-dashboard') {
        renderDashboard();
    }
}

// --- Theme Controller ---
function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);

    // Toggle theme button actives
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    if (themeName === 'light') {
        document.getElementById('theme-light').classList.add('active');
    } else {
        document.getElementById('theme-dark').classList.add('active');
    }

    saveStateToStorage();
}

function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById('greeting-date').innerText = today.toLocaleDateString('en-US', options);
}

// --- Render Operations ---
function renderAll() {
    renderMetrics();
    renderDashboard();
    if (state.activeView === 'view-transactions') renderLedger();
    if (state.activeView === 'view-budgets') renderBudgets();
    if (state.activeView === 'view-analytics') renderAnalytics();
    if (state.activeView === 'view-settings') renderSettingsView();
}

// Global Balance, Income, Expense Card Metrics
function renderMetrics() {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    // Filter current month transactions
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        // Let's summarize current calendar month statistics
        if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            if (tx.type === 'income') {
                incomeTotal += tx.amount;
                incomeCount++;
            } else {
                expenseTotal += tx.amount;
                expenseCount++;
            }
        }
    });

    const netBalance = incomeTotal - expenseTotal;

    // Format numbers
    document.getElementById('val-net-balance').innerText = formatCurrency(netBalance);
    document.getElementById('val-income').innerText = formatCurrency(incomeTotal);
    document.getElementById('val-expenses').innerText = formatCurrency(expenseTotal);

    // Details tags
    document.getElementById('lbl-income-details').innerText = `${incomeCount} incomes this month`;
    document.getElementById('lbl-expense-details').innerText = `${expenseCount} expenses this month`;

    const statusLabel = document.getElementById('lbl-balance-status');
    if (netBalance > 0) {
        statusLabel.innerText = 'Positive net flow this month';
        statusLabel.style.color = 'var(--success)';
    } else if (netBalance < 0) {
        statusLabel.innerText = 'Negative net flow this month';
        statusLabel.style.color = 'var(--danger)';
    } else {
        statusLabel.innerText = 'Balanced cash flow this month';
        statusLabel.style.color = 'var(--text-secondary)';
    }
}

// Format Helper
function formatCurrency(val) {
    const prefix = val < 0 ? '-' : '';
    return `${prefix}₹${Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 1. DASHBOARD VIEW RENDERER
function renderDashboard() {
    renderMetrics();
    renderDonutChart();
    renderDashboardBudgets();
    renderRecentTransactions();
}

// Donut Chart - Expenses Breakdown SVG
// Donut Chart - Expenses Breakdown SVG
function renderDonutChart() {
    const donutSvg = document.getElementById('svg-donut');
    const legendList = document.getElementById('chart-legends-list');
    const donutTotalLabel = document.getElementById('donut-total-spent');

    // 1. Calculate expenses by category
    const categoryTotals = {};
    let totalExpense = 0;

    // Filter current month expenses
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
            totalExpense += tx.amount;
        }
    });

    donutTotalLabel.innerText = formatCurrency(totalExpense);

    if (totalExpense === 0) {
        // Empty state gray circle
        donutSvg.innerHTML = `
      <circle cx="110" cy="110" r="70" fill="transparent" stroke="var(--border-color)" stroke-width="16"></circle>
    `;
        legendList.innerHTML = `
      <div class="legend-item" style="grid-column: span 2; justify-content: center;">
        <span class="legend-color" style="background-color: var(--text-muted)"></span>
        <span>No expenses recorded this month</span>
      </div>
    `;
        return;
    }

    // 2. Generate SVG circle rings
    const circumference = 2 * Math.PI * 70; // r=70 -> ~439.82
    let accumulatedOffset = 0;
    let segmentsHTML = '';
    let legendsHTML = '';

    // Get active categories that have expense amounts
    const activeExpenseCats = Object.keys(categoryTotals).map(catId => {
        return {
            category: state.categories.find(c => c.id === catId) || { name: 'Unknown', icon: '🏷️', color: 220 },
            amount: categoryTotals[catId],
            pct: (categoryTotals[catId] / totalExpense) * 100
        };
    }).sort((a, b) => b.amount - a.amount);

    // Group SVG paths
    segmentsHTML += `<g transform="rotate(-90 110 110)">`;

    activeExpenseCats.forEach((item, index) => {
        const strokeDash = (item.amount / totalExpense) * circumference;
        const dashOffset = -accumulatedOffset;
        accumulatedOffset += strokeDash;

        const color = `hsl(${item.category.color}, 84%, 54%)`;

        // Render path donut segment
        segmentsHTML += `
      <path class="donut-segment" 
            d="M 110,40 A 70,70 0 1,1 109.99,40 Z" 
            fill="transparent" 
            stroke="${color}" 
            stroke-width="16" 
            stroke-dasharray="${strokeDash} ${circumference}" 
            stroke-dashoffset="${dashOffset}"
            data-name="${item.category.name}"
            data-amount="${formatCurrency(item.amount)}"
            data-pct="${item.pct.toFixed(0)}%">
      </path>
    `;

        // Legend Badge
        legendsHTML += `
      <div class="legend-item" data-cat-id="${item.category.id}" style="--cat-hue: ${item.category.color}">
        <span class="legend-color"></span>
        <span>${item.category.icon} ${item.category.name} (${item.pct.toFixed(0)}%)</span>
      </div>
    `;
    });

    segmentsHTML += `</g>`;
    donutSvg.innerHTML = segmentsHTML;
    legendList.innerHTML = legendsHTML;

    // Setup donut interactivity (Tooltips & Hover effects)
    const segments = donutSvg.querySelectorAll('.donut-segment');
    const tooltip = document.getElementById('chart-tooltip');

    segments.forEach(seg => {
        seg.addEventListener('mouseenter', (e) => {
            const name = seg.getAttribute('data-name');
            const amt = seg.getAttribute('data-amount');
            const pct = seg.getAttribute('data-pct');

            // Update central total view
            donutTotalLabel.innerText = amt;
            donutTotalLabel.style.color = seg.getAttribute('stroke');
            document.querySelector('.donut-center-title').innerText = name;

            // Show tooltip
            tooltip.innerText = `${name}: ${amt} (${pct})`;
            tooltip.style.opacity = '1';
        });

        seg.addEventListener('mousemove', (e) => {
            // Position tooltip relative to container boundaries
            const containerRect = document.getElementById('donut-chart-container').getBoundingClientRect();
            const x = e.clientX - containerRect.left;
            const y = e.clientY - containerRect.top - 40;

            tooltip.style.transform = `translate(${x}px, ${y}px)`;
        });

        seg.addEventListener('mouseleave', () => {
            // Revert center text
            donutTotalLabel.innerText = formatCurrency(totalExpense);
            donutTotalLabel.style.color = 'var(--text-primary)';
            document.querySelector('.donut-center-title').innerText = 'Total Spent';

            // Hide tooltip
            tooltip.style.opacity = '0';
        });
    });
}

// Render Dashboard budgets list status
function renderDashboardBudgets() {
    const container = document.getElementById('dash-budgets-list');
    container.innerHTML = '';

    const activeBudgets = Object.keys(state.budgets).filter(catId => state.budgets[catId] > 0);

    if (activeBudgets.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <h3>No Budgets Set</h3>
        <p>Define category limits in the Budgets tab to track operational limits.</p>
      </div>
    `;
        return;
    }

    // Calculate current month expenses per budget category
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const totals = {};

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
        }
    });

    // Display top budgets on dashboard
    activeBudgets.forEach(catId => {
        const category = state.categories.find(c => c.id === catId);
        if (!category) return;

        const spent = totals[catId] || 0;
        const limit = state.budgets[catId];
        const pct = Math.min((spent / limit) * 100, 100);
        const balance = limit - spent;

        let progressBarClass = 'success';
        if (pct >= 100) {
            progressBarClass = 'danger';
        } else if (pct >= 85) {
            progressBarClass = 'warning';
        }

        const budgetItem = document.createElement('div');
        budgetItem.style.marginBottom = '16px';
        budgetItem.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:0.875rem;">
        <span>${category.icon} ${category.name}</span>
        <span style="color:${balance < 0 ? 'var(--danger)' : 'var(--text-secondary)'}">
          ${formatCurrency(spent)} / ${formatCurrency(limit)}
        </span>
      </div>
      <div class="budget-progress-container" style="margin-top:6px;">
        <div class="budget-progress-bar ${progressBarClass}" style="width: ${pct}%"></div>
      </div>
    `;
        container.appendChild(budgetItem);
    });
}

// Render Top 5 Recent Transactions on Dashboard
// Render Top 5 Recent Transactions on Dashboard
function renderRecentTransactions() {
    const container = document.getElementById('dash-transactions-list');
    container.innerHTML = '';

    // Sort transactions by date desc, then by creation
    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <h3>No Transactions Yet</h3>
        <p>Click the "Add Transaction" button to record your financial logs.</p>
      </div>
    `;
        return;
    }

    sorted.forEach(tx => {
        const element = createTransactionRow(tx);
        container.appendChild(element);
    });
}

// Helper to create Transaction DOM Element
function createTransactionRow(tx) {
    const category = state.categories.find(c => c.id === tx.category) || { name: 'Other', icon: '🏷️', color: 220 };
    const dateFormatted = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const element = document.createElement('div');
    element.className = 'transaction-item';
    element.setAttribute('data-id', tx.id);

    const amountSign = tx.type === 'income' ? '+' : '-';
    const amountClass = tx.type === 'income' ? 'income' : 'expense';

    element.innerHTML = `
    <div class="tx-info" style="--cat-hue: ${category.color}">
      <div class="tx-icon-wrapper">
        <span style="font-size:1.25rem;">${category.icon}</span>
      </div>
      <div class="tx-details">
        <div class="tx-name">${tx.description}</div>
        <div class="tx-meta">
          <span>${category.name}</span>
          <span>•</span>
          <span>${dateFormatted}</span>
        </div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:20px;">
      <div class="tx-amount ${amountClass}">
        ${amountSign}${formatCurrency(tx.amount)}
      </div>
      <div class="tx-actions">
        <button class="tx-btn btn-edit" title="Edit Transaction" onclick="openTransactionModal('${tx.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="tx-btn btn-delete" title="Delete Transaction" onclick="deleteTransaction('${tx.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
  `;
    return element;
}

// 2. LEDGER LIST VIEW RENDERER
function renderLedger() {
    const container = document.getElementById('ledger-records-list');
    const countLabel = document.getElementById('lbl-ledger-count');
    container.innerHTML = '';

    // Get filters
    const searchVal = document.getElementById('filter-search').value.toLowerCase().trim();
    const typeFilter = document.getElementById('filter-type').value;
    const catFilter = document.getElementById('filter-category').value;

    // Filter transaction states
    const filtered = state.transactions.filter(tx => {
        // Type Filter
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

        // Category Filter
        if (catFilter !== 'all' && tx.category !== catFilter) return false;

        // Text Search
        if (searchVal) {
            const matchDesc = tx.description.toLowerCase().includes(searchVal);
            const matchNotes = tx.notes && tx.notes.toLowerCase().includes(searchVal);
            if (!matchDesc && !matchNotes) return false;
        }

        return true;
    });

    // Sort Date Descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    countLabel.innerText = `Showing ${filtered.length} of ${state.transactions.length} records`;

    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <h3>No Matching Records</h3>
        <p>Try resetting filters or adjusting search queries to view older logs.</p>
      </div>
    `;
        return;
    }

    filtered.forEach(tx => {
        container.appendChild(createTransactionRow(tx));
    });
}

function resetFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-category').value = 'all';
    renderLedger();
}

function populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    const currentVal = select.value;

    select.innerHTML = '<option value="all">All Categories</option>';

    state.categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    select.value = currentVal;
}

// 3. BUDGETS ALLOCATION PANEL RENDERER
function renderBudgets() {
    const grid = document.getElementById('budget-targets-grid');
    grid.innerHTML = '';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const expenseTotals = {};

    // Compute expenses by category
    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            expenseTotals[tx.category] = (expenseTotals[tx.category] || 0) + tx.amount;
        }
    });

    // Filter only expense categories for display
    const expenseCategories = state.categories.filter(c => c.type === 'expense' || c.id !== 'cat-salary' && c.id !== 'cat-investments');

    expenseCategories.forEach(cat => {
        const limit = state.budgets[cat.id] || 0;
        const spent = expenseTotals[cat.id] || 0;
        const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const remaining = limit - spent;

        let pctLabel = limit > 0 ? `${pct.toFixed(0)}% Used` : 'Unconstrained';
        let progressColorClass = 'success';
        let warningElement = '';

        if (limit > 0) {
            if (spent >= limit) {
                progressColorClass = 'danger';
                pctLabel = '100% Exceeded';
                warningElement = `
          <div class="budget-alert danger">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>Budget Exceeded by ${formatCurrency(Math.abs(remaining))}!</span>
          </div>
        `;
            } else if (pct >= 85) {
                progressColorClass = 'warning';
                warningElement = `
          <div class="budget-alert warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>Critical: ${pct.toFixed(0)}% used. Limit close!</span>
          </div>
        `;
            }
        }

        const card = document.createElement('div');
        card.className = 'card budget-card';
        card.setAttribute('style', `--cat-hue: ${cat.color}`);

        card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight: 800; font-size:1.1rem;">${cat.icon} ${cat.name}</span>
        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="openBudgetModal('${cat.id}')">Configure</button>
      </div>

      <div style="margin-top: 16px;">
        <div style="font-size: 1.5rem; font-weight:800; letter-spacing:-0.5px;">
          ${limit > 0 ? formatCurrency(limit) : 'No Limit Set'}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top:2px;">Monthly Spending limit</div>
      </div>

      <div class="budget-progress-container">
        <div class="budget-progress-bar ${progressColorClass}" style="width: ${limit > 0 ? pct : 0}%"></div>
      </div>

      <div class="budget-info-row">
        <span>Spent: ${formatCurrency(spent)}</span>
        <span class="budget-pct">${pctLabel}</span>
      </div>

      ${warningElement}
    `;
        grid.appendChild(card);
    });
}

// 4. ANALYTICS REPORT VIEW RENDERER
function renderAnalytics() {
    renderSavingsRateMetrics();
    renderSpendingBarChart();
    renderCategoricalOutlayReport();
}

function renderSavingsRateMetrics() {
    let totalIncome = 0;
    let totalExpense = 0;
    let expenseDays = {};

    // Look at current year's transactions
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            if (tx.type === 'income') {
                totalIncome += tx.amount;
            } else {
                totalExpense += tx.amount;
                // Group dates to find average velocity
                expenseDays[tx.date] = true;
            }
        }
    });

    // Calculate Savings Rate
    const savings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, (savings / totalIncome) * 100) : 0;
    document.getElementById('val-savings-rate').innerText = `${savingsRate.toFixed(0)}%`;

    // Fixed vs Variable Ratio breakdown (simplified approximation)
    // Utilities, Housing, Transport, Health, Food -> Fixed
    // Shopping, Entertainment, Other -> Variable
    let fixedSpent = 0;
    let varSpent = 0;
    const fixedCategories = ['cat-utilities', 'cat-housing', 'cat-transport', 'cat-health', 'cat-food'];

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            if (fixedCategories.includes(tx.category)) {
                fixedSpent += tx.amount;
            } else {
                varSpent += tx.amount;
            }
        }
    });

    const totalSpentAll = fixedSpent + varSpent;
    if (totalSpentAll > 0) {
        const fixedPct = (fixedSpent / totalSpentAll) * 100;
        const varPct = (varSpent / totalSpentAll) * 100;
        document.getElementById('val-expense-ratio').innerText = `${fixedPct.toFixed(0)}% / ${varPct.toFixed(0)}%`;
    } else {
        document.getElementById('val-expense-ratio').innerText = '0% / 0%';
    }

    // Daily Outflow Velocity
    // Count number of calendar days in current month up to today
    const daysPassed = now.getDate();
    const dailyAverage = totalExpense / daysPassed;
    document.getElementById('val-daily-avg').innerText = formatCurrency(dailyAverage);
}

function renderSpendingBarChart() {
    const chartWrapper = document.getElementById('svg-bar-chart-container');
    chartWrapper.innerHTML = '';

    // Let's summarize spending for the last 6 calendar months
    const now = new Date();
    const monthData = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthData.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            label: d.toLocaleDateString('en-US', { month: 'short' }),
            amount: 0
        });
    }

    state.transactions.forEach(tx => {
        if (tx.type === 'expense') {
            const txDate = new Date(tx.date);
            const txYear = txDate.getFullYear();
            const txMonth = txDate.getMonth();

            // Match to one of our 6 columns
            const match = monthData.find(m => m.year === txYear && m.month === txMonth);
            if (match) {
                match.amount += tx.amount;
            }
        }
    });

    // Calculate scaling
    const maxAmount = Math.max(...monthData.map(m => m.amount), 100);

    monthData.forEach(m => {
        const pctHeight = (m.amount / maxAmount) * 80; // keep max at 80% to avoid clipping labels
        const column = document.createElement('div');
        column.className = 'bar-column';

        column.innerHTML = `
      <span class="bar-val" style="color: ${m.amount > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">
        ₹${Math.round(m.amount)}
      </span>
      <div class="bar-pill" style="height: ${Math.max(pctHeight, 4)}%; background-color: var(--primary);"></div>
      <span class="bar-label">${m.label}</span>
    `;
        chartWrapper.appendChild(column);
    });
}

function renderCategoricalOutlayReport() {
    const tbody = document.getElementById('tbl-category-report-body');
    tbody.innerHTML = '';

    // Get total expense
    let totalExpense = 0;
    const categoryCounts = {};
    const categorySums = {};

    // Accumulate over entire ledger records
    state.transactions.forEach(tx => {
        if (tx.type === 'expense') {
            categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.amount;
            categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
            totalExpense += tx.amount;
        }
    });

    const sortedCats = Object.keys(categorySums).sort((a, b) => categorySums[b] - categorySums[a]);

    if (sortedCats.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-secondary);">No ledger records to display</td>
      </tr>
    `;
        return;
    }

    sortedCats.forEach(catId => {
        const category = state.categories.find(c => c.id === catId) || { name: 'Other', icon: '🏷️', color: 220 };
        const spent = categorySums[catId];
        const count = categoryCounts[catId];
        const pct = totalExpense > 0 ? (spent / totalExpense) * 100 : 0;

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        row.innerHTML = `
      <td style="padding: 14px 16px; font-weight:700;">${category.icon} ${category.name}</td>
      <td style="padding: 14px 16px; text-align: right; color:var(--text-secondary);">${count} transactions</td>
      <td style="padding: 14px 16px; text-align: right; font-weight:800;">${formatCurrency(spent)}</td>
      <td style="padding: 14px 16px; text-align: right; font-weight:700; color:var(--primary);">${pct.toFixed(1)}%</td>
    `;
        tbody.appendChild(row);
    });
}

// 5. SETTINGS VIEW RENDERER
function renderSettingsView() {
    const container = document.getElementById('settings-categories-list');
    container.innerHTML = '';

    state.categories.forEach(cat => {
        const badge = document.createElement('span');
        badge.className = 'cat-badge';
        badge.setAttribute('style', `--cat-hue: ${cat.color}`);

        // E.g., custom categories can have a delete button inside settings
        const isCustom = !DEFAULT_CATEGORIES.some(dc => dc.id === cat.id);
        const deleteBtn = isCustom
            ? `<button onclick="deleteCustomCategory('${cat.id}')" style="margin-left:6px; color:var(--danger); font-size:10px; font-weight:800;">✕</button>`
            : '';

        badge.innerHTML = `${cat.icon} ${cat.name} ${deleteBtn}`;
        container.appendChild(badge);
    });

    // Render Category Swatch Color selection
    const swatchPicker = document.getElementById('cat-color-selector');
    swatchPicker.innerHTML = '';
    PRESET_HUES.forEach((hue, idx) => {
        const swatch = document.createElement('div');
        swatch.className = `color-swatch ${idx === 0 ? 'selected' : ''}`;
        swatch.style.backgroundColor = `hsl(${hue}, var(--p-s), var(--p-l))`;
        swatch.setAttribute('data-hue', hue);
        swatch.addEventListener('click', () => {
            swatchPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
        });
        swatchPicker.appendChild(swatch);
    });


}

// --- CRUD Operations handlers ---

// Transactions Modal
function openTransactionModal(editId = null) {
    const modal = document.getElementById('modal-transaction');
    const modalTitle = document.getElementById('tx-modal-title');
    const form = document.getElementById('form-transaction');

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tx-date').value = today;

    if (editId) {
        // EDIT MODE
        const tx = state.transactions.find(t => t.id === editId);
        if (!tx) return;

        modalTitle.innerText = 'Modify Transaction Record';
        document.getElementById('tx-edit-id').value = tx.id;
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-date').value = tx.date;
        document.getElementById('tx-desc').value = tx.description;
        document.getElementById('tx-notes').value = tx.notes || '';

        // Segment controls
        if (tx.type === 'income') {
            document.getElementById('tx-type-income').checked = true;
        } else {
            document.getElementById('tx-type-expense').checked = true;
        }

        updateCategoryDropdown(tx.type, tx.category);
        updateSubmitButtonText(tx.type, true);
    } else {
        // NEW MODE
        modalTitle.innerText = 'Record New Cashflow';
        document.getElementById('tx-edit-id').value = '';
        form.reset();
        document.getElementById('tx-date').value = today;
        document.getElementById('tx-type-expense').checked = true;
        updateCategoryDropdown('expense');
        updateSubmitButtonText('expense', false);
    }

    modal.classList.add('active');
}

function closeTransactionModal() {
    document.getElementById('modal-transaction').classList.remove('active');
}

function updateSubmitButtonText(type, isEdit = false) {
    const btn = document.getElementById('btn-submit-tx');
    const prefix = isEdit ? 'Save Changes' : 'Record';
    if (type === 'income') {
        btn.innerText = `${prefix} Income`;
        btn.className = 'btn btn-primary';
        btn.style.backgroundColor = 'var(--success)';
    } else {
        btn.innerText = `${prefix} Outflow`;
        btn.className = 'btn btn-primary';
        btn.style.backgroundColor = 'var(--primary)';
    }
}

function updateCategoryDropdown(type, selectVal = null) {
    const select = document.getElementById('tx-category');
    select.innerHTML = '';

    const filtered = state.categories.filter(cat => cat.type === type || cat.type === 'both');

    filtered.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    if (selectVal) {
        select.value = selectVal;
    }
}

function handleTransactionSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('tx-edit-id').value;
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;
    const description = document.getElementById('tx-desc').value.trim();
    const notes = document.getElementById('tx-notes').value.trim();

    // Basic Validation
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid currency transaction amount.');
        return;
    }

    const txData = {
        id: editId || `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        amount,
        date,
        category,
        description,
        notes
    };

    if (editId) {
        // Edit existing transaction
        const index = state.transactions.findIndex(t => t.id === editId);
        if (index !== -1) {
            state.transactions[index] = txData;
        }
    } else {
        // Add new transaction
        state.transactions.push(txData);
    }

    saveStateToStorage();
    closeTransactionModal();
    renderAll();

    // Budget Alerts (Check if budget has been exceeded)
    if (type === 'expense') {
        checkCategoryBudgetLimits(category);
    }
}

// Transactions Delete
function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction record?')) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveStateToStorage();
        renderAll();
    }
}

// Budget Modal
function openBudgetModal(catId) {
    const modal = document.getElementById('modal-budget');
    const category = state.categories.find(c => c.id === catId);
    if (!category) return;

    document.getElementById('budget-category-id').value = catId;
    document.getElementById('budget-category-name').value = `${category.icon} ${category.name}`;
    document.getElementById('budget-amount').value = state.budgets[catId] || 0;

    modal.classList.add('active');
}

// Budget Closures
function closeBudgetModal() {
    document.getElementById('modal-budget').classList.remove('active');
}

function handleBudgetSubmit(e) {
    e.preventDefault();
    const catId = document.getElementById('budget-category-id').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid budget limit target.');
        return;
    }

    state.budgets[catId] = amount;
    saveStateToStorage();
    closeBudgetModal();
    renderBudgets();
    renderDashboard();
}

// Category Creation
function handleAddCategorySubmit(e) {
    e.preventDefault();
    const name = document.getElementById('new-cat-name').value.trim();
    const icon = document.getElementById('new-cat-icon').value;
    const selectedSwatch = document.querySelector('#cat-color-selector .color-swatch.selected');
    const color = selectedSwatch ? parseInt(selectedSwatch.getAttribute('data-hue')) : 220;

    if (!name) return;

    // Generate ID
    const id = `cat-custom-${Date.now()}`;

    const newCat = {
        id,
        name,
        icon,
        color,
        type: 'expense' // Custom categories default to expenses
    };

    state.categories.push(newCat);
    saveStateToStorage();

    // Reset Form
    document.getElementById('new-cat-name').value = '';

    renderSettingsView();
    populateCategoryFilter();
}

function deleteCustomCategory(id) {
    if (confirm('Deleting this category will categorise its associated transactions as "Other / Misc". Proceed?')) {
        // 1. Move transactions using this category to 'cat-other'
        state.transactions = state.transactions.map(tx => {
            if (tx.category === id) {
                return { ...tx, category: 'cat-other' };
            }
            return tx;
        });

        // 2. Remove category and budget
        state.categories = state.categories.filter(c => c.id !== id);
        delete state.budgets[id];

        saveStateToStorage();
        renderAll();
    }
}

// --- Check budget thresholds ---
function checkCategoryBudgetLimits(catId) {
    const budget = state.budgets[catId];
    if (!budget || budget <= 0) return;

    const category = state.categories.find(c => c.id === catId);
    if (!category) return;

    // Sum spending in current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let spent = 0;

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.category === catId && tx.type === 'expense' && txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            spent += tx.amount;
        }
    });

    if (spent >= budget) {
        alert(`⚠️ Warning: You have exceeded your monthly budget for "${category.icon} ${category.name}"!\nBudget limit: ₹${budget}\nSpent so far: ₹${spent.toFixed(2)}`);
    } else if (spent >= budget * 0.85) {
        alert(`⚠️ Note: You have used ${((spent / budget) * 100).toFixed(0)}% of your monthly budget for "${category.icon} ${category.name}".\nBudget limit: ₹${budget}\nSpent so far: ₹${spent.toFixed(2)}`);
    }
}

// --- Data Integrations Exports ---

function exportDatabaseJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `monthly_expenses_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
}

function calculateFinancialStats() {
    let incomeTotal = 0;
    let expenseTotal = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    state.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
            if (tx.type === 'income') {
                incomeTotal += tx.amount;
            } else {
                expenseTotal += tx.amount;
            }
        }
    });

    return {
        netBalance: incomeTotal - expenseTotal,
        totalIncome: incomeTotal,
        totalExpenses: expenseTotal
    };
}

function exportLedgerPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("The PDF export library is still loading. Please check your internet connection and try again in a moment.");
        return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF('l', 'mm', 'a4');

    // Palette definition
    const primaryColor = [79, 70, 229]; // Indigo
    const darkColor = [15, 23, 42]; // Slate 900
    const lightGray = [248, 250, 252]; // Slate 50
    const borderGray = [226, 232, 240]; // Slate 200
    const textSecondaryColor = [100, 116, 139]; // Slate 500

    // 1. Premium Header Banner (Landscape 297mm wide)
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 297, 38, 'F');

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("MONTHLY EXPENSES", 15, 22);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(199, 210, 254); // Indigo light
    doc.text("Personal Expense Ledger & Budget Statement", 15, 29);

    // Profile metadata (aligned to right margin)
    let userProfileName = "User";
    const accounts = JSON.parse(localStorage.getItem('monthly_expenses_accounts') || '{}');
    const userAcc = Object.values(accounts).find(acc => acc.userId === currentUser);
    if (userAcc) {
        userProfileName = userAcc.username;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`User: ${userProfileName}`, 220, 17);
    doc.setFont('helvetica', 'normal');
    doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, 220, 22);
    doc.text(`Status: Generated Locally`, 220, 27);

    // Reset default colors
    doc.setTextColor(...darkColor);

    // 2. Financial Summary Cards (Current month values - horizontal layout)
    const stats = calculateFinancialStats();
    const cardW = 85;
    const cardH = 22;
    const gap = 11;
    let startX = 15;
    const startY = 46;

    // Balance Card
    doc.setFillColor(...lightGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textSecondaryColor);
    doc.text("NET BALANCE", startX + 5, startY + 6);
    doc.setFontSize(11);
    doc.setTextColor(...(stats.netBalance >= 0 ? [16, 185, 129] : [239, 68, 68]));
    const balancePrefix = stats.netBalance >= 0 ? '' : '-';
    doc.text(`${balancePrefix}Rs. ${Math.abs(stats.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, startX + 5, startY + 15);

    // Total Income Card
    startX += cardW + gap;
    doc.setFillColor(...lightGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textSecondaryColor);
    doc.text("TOTAL INCOME", startX + 5, startY + 6);
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // Success green
    doc.text(`Rs. ${stats.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, startX + 5, startY + 15);

    // Total Expenses Card
    startX += cardW + gap;
    doc.setFillColor(...lightGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...borderGray);
    doc.roundedRect(startX, startY, cardW, cardH, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textSecondaryColor);
    doc.text("TOTAL EXPENSES", startX + 5, startY + 6);
    doc.setFontSize(11);
    doc.setTextColor(239, 68, 68); // Danger coral
    doc.text(`Rs. ${stats.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, startX + 5, startY + 15);

    // 3. Transactions Table Header
    const tableY = 78;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text("TRANSACTION LEDGER RECORDS", 15, tableY);

    // Draw headers (spanning full width 267mm)
    const headerY = tableY + 6;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, headerY, 267, 8, 'F');
    doc.setDrawColor(...borderGray);
    doc.line(15, headerY, 282, headerY);
    doc.line(15, headerY + 8, 282, headerY + 8);

    doc.setFontSize(8.5);
    doc.setTextColor(...textSecondaryColor);
    doc.text("Date", 18, headerY + 5.5);
    doc.text("Category", 50, headerY + 5.5);
    doc.text("Description", 95, headerY + 5.5);
    doc.text("Type", 215, headerY + 5.5);
    doc.text("Amount", 250, headerY + 5.5);

    // Render Row entries
    let y = headerY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    if (state.transactions.length === 0) {
        y += 8;
        doc.setTextColor(...textSecondaryColor);
        doc.text("No transactions recorded.", 18, y);
        y += 4;
        doc.line(15, y, 282, y);
    } else {
        // Sort transactions by date descending (newest first)
        const sortedTxs = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTxs.forEach((tx) => {
            // Check page overflow (Landscape height is 210mm)
            if (y > 185) {
                doc.addPage();

                // Draw top page header
                doc.setFillColor(...primaryColor);
                doc.rect(0, 0, 297, 10, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(255, 255, 255);
                doc.text("Monthly Expenses Report", 15, 6.5);

                y = 20;

                // Draw table headers again on new page
                doc.setFillColor(241, 245, 249);
                doc.rect(15, y, 267, 8, 'F');
                doc.setDrawColor(...borderGray);
                doc.line(15, y, 282, y);
                doc.line(15, y + 8, 282, y + 8);
                doc.setTextColor(...textSecondaryColor);
                doc.text("Date", 18, y + 5.5);
                doc.text("Category", 50, y + 5.5);
                doc.text("Description", 95, y + 5.5);
                doc.text("Type", 215, y + 5.5);
                doc.text("Amount", 250, y + 5.5);
                y += 8;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
            }

            const category = state.categories.find(c => c.id === tx.category) || { name: 'Other' };

            // Line separator
            doc.setDrawColor(241, 245, 249);
            doc.line(15, y + 7, 282, y + 7);

            // Contents
            doc.setTextColor(...darkColor);
            doc.text(tx.date, 18, y + 4.5);
            doc.text(category.name, 50, y + 4.5);

            // Description (Truncate if too long)
            let desc = tx.description || '';
            if (desc.length > 55) desc = desc.substring(0, 52) + '...';
            doc.text(desc, 95, y + 4.5);

            // Type styling
            const isIncome = tx.type === 'income';
            doc.setTextColor(isIncome ? 16 : 220, isIncome ? 185 : 80, isIncome ? 129 : 80);
            doc.setFont('helvetica', 'bold');
            doc.text(tx.type.toUpperCase(), 215, y + 4.5);

            // Amount in Rs.
            doc.setFont('helvetica', 'bold');
            const amtStr = `Rs. ${Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            doc.text(amtStr, 250, y + 4.5);

            doc.setFont('helvetica', 'normal');
            y += 7;
        });

        // Close the table
        doc.setDrawColor(...borderGray);
        doc.line(15, y, 282, y);
    }

    // File save
    const cleanProfile = userProfileName.toLowerCase().replace(/\s+/g, '_');
    const filename = `monthly_expenses_${cleanProfile}_statement_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

function importDatabaseJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed.transactions && parsed.categories && parsed.budgets) {
                state = {
                    transactions: parsed.transactions || [],
                    budgets: parsed.budgets || {},
                    categories: parsed.categories || [],
                    theme: parsed.theme || 'light',
                    activeView: 'view-dashboard'
                };
                saveStateToStorage();
                applyTheme(state.theme);
                renderAll();
                alert('Database restore completed successfully!');
                navigate('view-dashboard');
            } else {
                alert('Malformed backup file: Missing key structural records.');
            }
        } catch (err) {
            alert('Failed to parse selected database JSON backup file.');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function handleHardReset() {
    if (confirm('DANGER WIPE: Are you sure you want to permanently clear all records, categories, and budgets? This cannot be undone.')) {
        state = {
            transactions: [],
            budgets: {},
            categories: [...DEFAULT_CATEGORIES],
            theme: 'light',
            language: 'en',
            activeView: 'view-dashboard'
        };
        saveStateToStorage();
        applyTheme('light');
        renderAll();
        alert('Monthly Expenses database structure completely reset.');
    }
}

// --- Load Sample Demo Data ---
function loadDemoData(triggerAlert = true) {
    const now = new Date();
    const formatOffsetDate = (offsetDays) => {
        const d = new Date();
        d.setDate(now.getDate() - offsetDays);
        return d.toISOString().split('T')[0];
    };

    // Preset sample transactions for visual richness
    const demoTransactions = [
        { id: 'tx-demo-1', type: 'income', amount: 125000.00, date: formatOffsetDate(12), category: 'cat-salary', description: 'Monthly Salary Paycheck', notes: 'Direct deposit primary job' },
        { id: 'tx-demo-2', type: 'income', amount: 8500.00, date: formatOffsetDate(5), category: 'cat-investments', description: 'Dividend Payout', notes: 'Mutual fund returns' },
        { id: 'tx-demo-3', type: 'expense', amount: 2800.00, date: formatOffsetDate(1), category: 'cat-utilities', description: 'Electricity Bill', notes: 'Autopay energy' },
        { id: 'tx-demo-4', type: 'expense', amount: 25000.00, date: formatOffsetDate(10), category: 'cat-housing', description: 'Monthly House Rent', notes: '2BHK Apartment' },
        { id: 'tx-demo-5', type: 'expense', amount: 1250.00, date: formatOffsetDate(2), category: 'cat-food', description: 'Dinner at Restaurant', notes: 'Dinner with friends' },
        { id: 'tx-demo-6', type: 'expense', amount: 350.00, date: formatOffsetDate(0), category: 'cat-food', description: 'Cafe Coffee & Snacks', notes: 'Weekly brew check' },
        { id: 'tx-demo-7', type: 'expense', amount: 4500.00, date: formatOffsetDate(4), category: 'cat-shopping', description: 'Shopping Sneakers', notes: 'Casual wear' },
        { id: 'tx-demo-8', type: 'expense', amount: 499.00, date: formatOffsetDate(8), category: 'cat-entertainment', description: 'OTT Subscription', notes: 'Monthly fee recurring' },
        { id: 'tx-demo-9', type: 'expense', amount: 750.00, date: formatOffsetDate(3), category: 'cat-transport', description: 'Auto/Cab fare city commute', notes: 'Ride to office' },
        { id: 'tx-demo-10', type: 'expense', amount: 1200.00, date: formatOffsetDate(6), category: 'cat-health', description: 'Pharmacy Prescription', notes: 'Meds & Vitamins' },
        { id: 'tx-demo-11', type: 'expense', amount: 450.00, date: formatOffsetDate(2), category: 'cat-food', description: 'Takeaway Lunch Box', notes: 'Office cafeteria' },
        { id: 'tx-demo-12', type: 'expense', amount: 6500.00, date: formatOffsetDate(7), category: 'cat-shopping', description: 'Wireless Earbuds', notes: 'Electronics store' },
        { id: 'tx-demo-13', type: 'expense', amount: 1800.00, date: formatOffsetDate(5), category: 'cat-transport', description: 'Car Fuel Refill', notes: 'Petrol station' },
        { id: 'tx-demo-14', type: 'expense', amount: 1499.00, date: formatOffsetDate(11), category: 'cat-utilities', description: 'Broadband Fiber Internet', notes: 'Monthly fiber internet plan' }
    ];

    state.transactions = demoTransactions;
    state.budgets = { ...DEFAULT_BUDGETS };
    state.categories = [...DEFAULT_CATEGORIES];

    saveStateToStorage();
    renderAll();

    // Export PDF automatically
    exportLedgerPDF();

    if (triggerAlert) {
        alert('Financial ledger demo database loaded and statement downloaded successfully!\nWe configured sample incomes, fixed utilities, groceries, budgets, and shopping trends in Indian Rupees.');
        navigate('view-dashboard');
    }
}

// --- Google Translate Translation Engine ---

function initGoogleTranslate() {
    // 1. Inject hidden element for Google Translate widget
    if (!document.getElementById('google_translate_element')) {
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.display = 'none';
        document.body.appendChild(div);
    }

    // 2. Define standard Translate initialization callback
    window.googleTranslateElementInit = function () {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,pa,or,ur,as,mai,sa,kok,doi,ks,ne,sd,mni,brx,sat',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
        }, 'google_translate_element');

        // Let Google Translate load, then apply saved language
        setTimeout(applySavedLanguage, 800);
    };

    // 3. Inject Google Translate library script tag
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(script);
}

function changeLanguage(langCode) {
    state.language = langCode;
    saveStateToStorage();

    // Update dropdown menus values
    const sidebarSelect = document.getElementById('sidebar-language-select');
    const settingsSelect = document.getElementById('custom-language-select');
    if (sidebarSelect) sidebarSelect.value = langCode;
    if (settingsSelect) settingsSelect.value = langCode;

    // Set cookies for Google Translate persistence
    const cookieVal = langCode === 'en' ? '/en/en' : `/en/${langCode}`;
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname};`;

    // Trigger translation change in Google Translate Combo dropdown if present
    const selectEl = document.querySelector('.goog-te-combo');
    if (selectEl) {
        selectEl.value = langCode;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function applySavedLanguage() {
    const savedLang = state.language || 'en';

    // Sync custom dropdown values
    const sidebarSelect = document.getElementById('sidebar-language-select');
    const settingsSelect = document.getElementById('custom-language-select');
    if (sidebarSelect) sidebarSelect.value = savedLang;
    if (settingsSelect) settingsSelect.value = savedLang;

    // Apply translate combo select value
    const selectEl = document.querySelector('.goog-te-combo');
    if (selectEl && selectEl.value !== savedLang) {
        selectEl.value = savedLang;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
}


