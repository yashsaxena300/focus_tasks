/**
 * App Logic
 * Handles Time, Date, Task Lists, Persistence, and Settings
 */

// --- Constants & Config ---
const STORAGE_KEY = 'aesthetic_todo_data';
const DEFAULT_FONTS = 1;
const DEFAULT_DAILY_TASKS = [
    { id: 'dt1', text: 'Morning Stretch', type: 'daily' },
    { id: 'dt2', text: 'Read 15 Mins', type: 'daily' },
    { id: 'dt3', text: 'Clear Inbox', type: 'daily' }
];

// --- State Management ---
let state = {
    tasks: [], // { id, text, completed, type, dateAdded }
    dailyRoutine: [], // { id, text, type: 'daily' } - template for daily tasks
    settings: {
        font: 1,
        timeFormat: '12h', // '12h', '24h'
        dateFormat: 'Month', // 'Month', 'MM/DD', 'DD/MM'
        themeColor: 'green' // Default
    },
    lastOpenDate: null
};

// --- DOM Elements ---
const els = {
    app: document.getElementById('app'),
    mainView: document.getElementById('main-view'),
    settingsView: document.getElementById('settings-view'),
    timeDisplay: document.getElementById('time-display'),
    dateDisplay: document.getElementById('date-display'),
    progressBar: document.getElementById('time-progress-bar'),
    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    newTaskInput: document.getElementById('new-task-input'),
    settingsBtn: document.getElementById('settings-btn'),
    backBtn: document.getElementById('back-btn'),
    dailyTaskList: document.getElementById('daily-task-list'),
    addDailyTaskBtn: document.getElementById('add-daily-task-btn'),
    fontBtns: document.querySelectorAll('.font-btn'),
    colorBtns: document.querySelectorAll('.color-btn')
};

// --- Initialization ---
function init() {
    loadState();
    checkMidnightReset();

    // Initial Renders
    applySettings();
    ensureDailyTasks(); // Check if we need to backfill daily tasks
    renderTasks();
    renderDailySettings();
    updateTime();

    // Event Listeners
    setupEventListeners();

    // Initialize Feather Icons
    feather.replace();

    // Start Clock
    setInterval(updateTime, 1000);
}

function ensureDailyTasks() {
    // If we have a routine but no daily tasks in main list, add them (fixes legacy/empty state)
    const hasDailyTasks = state.tasks.some(t => t.type === 'daily');
    if (!hasDailyTasks && state.dailyRoutine.length > 0) {
        const today = new Date().toDateString();
        const dailyTasksToAdd = state.dailyRoutine.map(t => ({
            ...t,
            id: generateId(),
            completed: false,
            dateAdded: today
        }));
        state.tasks = [...dailyTasksToAdd, ...state.tasks];
        saveState();
        // renderTasks called after in init, or call here if used wildly
    }
}

// --- Persistence ---
function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        const saved = JSON.parse(raw);
        state = { ...state, ...saved };

        // Merge defaults if missing
        if (!state.dailyRoutine) state.dailyRoutine = [...DEFAULT_DAILY_TASKS];
    } else {
        // First Run
        state.dailyRoutine = [...DEFAULT_DAILY_TASKS];
        state.lastOpenDate = new Date().toDateString();

        // Populate initial tasks
        state.tasks = state.dailyRoutine.map(t => ({
            ...t,
            id: generateId(),
            completed: false,
            dateAdded: state.lastOpenDate
        }));
        saveState();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Midnight Logic ---
function checkMidnightReset() {
    const today = new Date().toDateString();
    // If last open date is NOT today, we reset
    if (state.lastOpenDate !== today) {
        // Reset Logic
        performDailyReset(today);
    }
}

function performDailyReset(todayDate) {
    // 1. Clear old tasks? 
    // "At midnight, the task list resets to daily tasks... and clears out user-added tasks from the previous day."
    // This implies we throw away everything and regenerate daily tasks.

    // Regenerate daily tasks
    const newDailyTasks = state.dailyRoutine.map(t => ({
        ...t,
        id: generateId(), // New IDs to avoid issues
        completed: false,
        dateAdded: todayDate
    }));

    // Replace current tasks with fresh daily tasks
    state.tasks = newDailyTasks;
    state.lastOpenDate = todayDate;
    saveState();
    renderTasks();
}

function resetDailyTasks() {
    // Helper if needed manually
    performDailyReset(new Date().toDateString());
}

// --- Time & Date ---
function updateTime() {
    const now = new Date();

    // Progress Bar
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const percent = (totalMinutes / 1440) * 100;
    els.progressBar.style.width = `${percent}%`;

    // Time Text
    let timeStr = '';
    if (state.settings.timeFormat === '24h') {
        timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } else {
        timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); // AM/PM implied by removal of hour12:false default usually, but let's be explicit
        // Actually toLocaleTimeString defaults to 12h often but includes AM/PM. 
        // Let's strip AM/PM if desired or keep it? "change how time shows between AM/PM or 24 hr". 
        // Implies: "10:42 AM" vs "10:42" (implied morning?) or "22:42".
        // Let's stick to standard formats.
        timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    els.timeDisplay.innerText = timeStr;

    // Date Text
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' }; // Month dd, yyyy
    let dateStr = '';

    if (state.settings.dateFormat === 'Month') {
        dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (state.settings.dateFormat === 'MM/DD') {
        dateStr = now.toLocaleDateString('en-US'); // defaults to M/D/Y usually in US locale
    } else if (state.settings.dateFormat === 'DD/MM') {
        dateStr = now.toLocaleDateString('en-GB'); // D/M/Y
    }

    els.dateDisplay.innerText = dateStr;
}

// --- View Rendering ---
function renderTasks() {
    els.taskList.innerHTML = '';
    if (state.tasks.length === 0) {
        els.emptyState.classList.remove('hidden');
    } else {
        els.emptyState.classList.add('hidden');

        // Sort? Prompt says "struck through task does not move".
        // So we just render simple order.
        state.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.onclick = (e) => toggleTask(task.id);

            li.innerHTML = `
                <div class="task-checkbox-wrapper">
                    <div class="custom-checkbox">
                        ${task.completed ? feather.icons.check.toSvg({ width: 14, height: 14, color: '#fff' }) : ''}
                    </div>
                </div>
                <span class="task-text">${escapeHtml(task.text)}</span>
            `;
            els.taskList.appendChild(li);
        });
    }
}

function renderDailySettings() {
    els.dailyTaskList.innerHTML = '';
    state.dailyRoutine.forEach((task, index) => {
        const div = document.createElement('div');
        div.className = 'daily-task-row';
        div.innerHTML = `
            <input type="text" value="${escapeHtml(task.text)}" onchange="updateDailyTask(${index}, this.value)">
            <i data-feather="trash-2" class="delete-btn" onclick="removeDailyTask(${index})"></i>
        `;
        els.dailyTaskList.appendChild(div);
    });
    feather.replace();
}

function applySettings() {
    // Font and Theme
    document.body.className = `font-${state.settings.font} theme-${state.settings.themeColor || 'green'}`;

    // Update active font button
    els.fontBtns.forEach(btn => {
        if (btn.dataset.font == state.settings.font) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update active color button
    els.colorBtns.forEach(btn => {
        if (btn.dataset.color === state.settings.themeColor) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// --- Actions ---
function addTask(text) {
    if (!text.trim()) return;
    const newTask = {
        id: generateId(),
        text: text.trim(),
        completed: false,
        type: 'extra',
        dateAdded: new Date().toDateString()
    };
    state.tasks.push(newTask);
    saveState();
    renderTasks();
    els.newTaskInput.value = '';
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveState();
        renderTasks();
    }
}

// Settings Actions
function updateDailyTask(index, newText) {
    if (newText.trim()) {
        state.dailyRoutine[index].text = newText.trim();
        saveState();
    }
}

function removeDailyTask(index) {
    state.dailyRoutine.splice(index, 1);
    saveState();
    renderDailySettings();
}

function addDailyTemplate() {
    state.dailyRoutine.push({ id: generateId(), text: '', type: 'daily' });
    saveState();
    renderDailySettings();
    // Focus last input?
    setTimeout(() => {
        const inputs = els.dailyTaskList.querySelectorAll('input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
}

// --- UI Navigation ---
function goToSettings() {
    els.mainView.classList.remove('active');
    els.mainView.classList.add('left');

    els.settingsView.classList.remove('right');
    els.settingsView.classList.add('active');
}

function goToMain() {
    els.settingsView.classList.remove('active');
    els.settingsView.classList.add('right');

    els.mainView.classList.remove('left');
    els.mainView.classList.add('active');

    // Re-check midnight in case they stayed in settings a long time? Unlikely but good practice
    // Also re-render tasks if daily list changed?
    // If daily tasks were modified, should we update current list?
    // Prompt doesn't explicitly say "update today's list if I change settings today", 
    // usually daily settings apply to *next* reset or strictly routine.
    // However, if I delete a daily task from settings, it might be confusing if it stays in today's list.
    // For simplicity and stability (don't delete work done today), we apply changes on NEXT reset.
}

// --- Events ---
function setupEventListeners() {
    // New Task Input
    els.newTaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTask(e.target.value);
    });

    // Navigation
    els.settingsBtn.addEventListener('click', goToSettings);
    els.backBtn.addEventListener('click', goToMain);

    // Time Toggles
    els.timeDisplay.addEventListener('click', () => {
        state.settings.timeFormat = state.settings.timeFormat === '12h' ? '24h' : '12h';
        saveState();
        updateTime();
    });

    els.dateDisplay.addEventListener('click', () => {
        const formats = ['Month', 'MM/DD', 'DD/MM'];
        const currentIdx = formats.indexOf(state.settings.dateFormat);
        const nextIdx = (currentIdx + 1) % formats.length;
        state.settings.dateFormat = formats[nextIdx];
        saveState();
        updateTime();
    });

    // Font Selection
    els.fontBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.font = parseInt(btn.dataset.font);
            saveState();
            applySettings();
        });
    });

    // Color Selection
    els.colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.settings.themeColor = btn.dataset.color;
            saveState();
            applySettings();
        });
    });

    // Daily Task Add
    els.addDailyTaskBtn.addEventListener('click', addDailyTemplate);
}

// --- Helpers ---
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Expose functions globally for inline handlers
window.toggleTask = toggleTask;
window.updateDailyTask = updateDailyTask;
window.removeDailyTask = removeDailyTask;

// Run
init();
