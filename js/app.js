// app.js - Main Dashboard Logic with Firebase Realtime Database
import { auth, db, messaging } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { ref, get, set, child, update } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";
import { getToken } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging.js";

document.addEventListener('DOMContentLoaded', () => {
    
    let currentUserUid = null;
    let userData = { habits: [], records: {} };
    let isDataLoaded = false;

    // Displays
    const displayName = document.getElementById('user-display-name');
    
    // Bottom Nav Hooks
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
        if(item.id === 'logout-btn') {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                signOut(auth).then(() => {
                    window.location.href = 'index.html';
                });
            });
        } else {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            });
        }
    });

    // 1. Auth Guard & Initial Data Fetch
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            displayName.textContent = `Hi, ${user.email.split('@')[0]}`;
            
            // Fetch User Data from Firebase
            try {
                const snapshot = await get(child(ref(db), `users/${user.uid}`));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    userData.habits = data.habits || [];
                    userData.records = data.records || {};
                } else {
                    // Initialize if missing
                    await saveDataToFirebase();
                }
            } catch (e) {
                console.error("Firebase read failed", e);
            }
            
            isDataLoaded = true;
            init(); // Proceed to boot up the frontend
        } else {
            // Not authenticated -> kick to login
            window.location.href = 'index.html';
        }
    });

    // 2. Base Dashboard Setup
    let weeklyChartInstance = null;
    const today = new Date();
    let selectedYear = today.getFullYear();
    let selectedMonth = today.getMonth(); // 0-11

    // DOM Elements
    const monthSelect = document.getElementById('month-select');
    const tableHeaderRow = document.getElementById('grid-header-row');
    const gridBody = document.getElementById('grid-body');
    const trackerMonthDisplay = document.getElementById('tracker-month-display');
    const noHabitsMsg = document.getElementById('no-habits-msg');
    const tableResponsive = document.querySelector('.table-responsive');
    
    const statTotal = document.getElementById('stat-total');
    const statGoalPct = document.getElementById('stat-goal-pct');
    const statGoalFill = document.getElementById('stat-goal-fill');
    const statWeeklyPct = document.getElementById('stat-weekly-pct');
    const statWeeklyFill = document.getElementById('stat-weekly-fill');

    // Bottom Sheet Elements
    const overlay = document.getElementById('sheet-overlay');
    const addSheet = document.getElementById('add-sheet');
    const editSheet = document.getElementById('edit-sheet');
    const fabButton = document.getElementById('fab-add-habit');

    function openSheet(sheetElement) {
        overlay.classList.add('active');
        sheetElement.classList.add('active');
    }

    function closeSheets() {
        overlay.classList.remove('active');
        addSheet.classList.remove('active');
        editSheet.classList.remove('active');
    }

    overlay.addEventListener('click', closeSheets);

    // Initialization Trigger
    function init() {
        populateMonthSelector();
        renderDashboard();
        initNotificationSystem(); // Now handles permissions UI
        setupPushNotifications();
    }

    async function setupPushNotifications() {
        if (!('serviceWorker' in navigator)) return;

        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            console.log('Service Worker registered with scope:', registration.scope);

            // Fetch current token if permission is already granted
            if (Notification.permission === 'granted') {
                const currentToken = await getToken(messaging, {
                    vapidKey: 'BJXt6YabhVluQeBc-BTCHBf4Hh4yEQq89YlYgFgW56gsDAQKAgOOqARsKnfNW52UBqqo2kWlr3sGcTn8a7pPyuw',
                    serviceWorkerRegistration: registration
                });

                if (currentToken && currentUserUid) {
                    await update(ref(db, `users/${currentUserUid}`), {
                        fcmToken: currentToken,
                        lastTokenUpdate: new Date().toISOString()
                    });
                }
            }
        } catch (err) {
            console.error('An error occurred while setting up push notifications:', err);
        }
    }

    async function ensureNotificationPermission() {
        if ("Notification" in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    await setupPushNotifications();
                }
            } catch (e) {
                console.error("Permission request failed", e);
            }
        }
    }

    // 3. Save to Firebase Wrapper
    async function saveDataToFirebase() {
        if (!currentUserUid) return;
        try {
            await set(ref(db, 'users/' + currentUserUid), userData);
        } catch (error) {
            console.error("Failed to commit to Firebase: ", error);
        }
    }

    // 4. Modals and Interactions
    fabButton.addEventListener('click', () => {
        ensureNotificationPermission();
        openSheet(addSheet);
        document.getElementById('new-habit-name').focus();
    });

    document.getElementById('add-habit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-habit-name').value.trim();
        if (nameInput) {
            userData.habits.push({
                id: 'hab_' + Date.now(),
                name: nameInput,
                createdAt: new Date().toISOString()
            });
            
            closeSheets();
            e.target.reset();
            renderDashboard(); // Optimistic UI update
            
            await saveDataToFirebase(); // Commit to Cloud
        }
    });

    monthSelect.addEventListener('change', (e) => {
        const [year, month] = e.target.value.split('-');
        selectedYear = parseInt(year);
        selectedMonth = parseInt(month);
        renderDashboard();
    });

    // 5. Build Grid
    function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
    function formatDateKey(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
    function isToday(year, month, day) {
        const t = new Date();
        return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
    }

    function calculateStreak(habitId) {
        let streak = 0;
        let d = new Date();
        while (true) {
            const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            if (userData.records[key] && userData.records[key].includes(habitId)) {
                streak++;
            } else {
                if (!isToday(d.getFullYear(), d.getMonth(), d.getDate())) break;
            }
            d.setDate(d.getDate() - 1);
        }
        return streak;
    }

    function renderDashboard() {
        if(!isDataLoaded) return;

        const habits = userData.habits;
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        trackerMonthDisplay.textContent = `${monthNames[selectedMonth]} ${selectedYear}`;

        if (habits.length === 0) {
            tableResponsive.classList.add('hidden');
            noHabitsMsg.classList.remove('hidden');
            statTotal.textContent = '0';
            updateProgressBars(0, 0); renderChart([]);
            return;
        }

        tableResponsive.classList.remove('hidden');
        noHabitsMsg.classList.add('hidden');
        statTotal.textContent = habits.length;

        // Header
        while (tableHeaderRow.cells.length > 2) tableHeaderRow.deleteCell(-1);

        for (let i = 1; i <= daysInMonth; i++) {
            const th = document.createElement('th');
            th.textContent = i;
            if (isToday(selectedYear, selectedMonth, i)) th.classList.add('col-today');
            tableHeaderRow.appendChild(th);
        }

        // Body
        gridBody.innerHTML = '';
        habits.forEach(habit => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.className = 'habit-name-col';
            const nameSpan = document.createElement('div');
            nameSpan.className = 'habit-name-text';
            nameSpan.textContent = habit.name;
            tdName.addEventListener('click', () => {
                editingHabitId = habit.id;
                document.getElementById('edit-habit-name').value = habit.name;
                openSheet(editSheet);
            });
            tdName.appendChild(nameSpan);
            tr.appendChild(tdName);

            const tdStreak = document.createElement('td');
            tdStreak.className = 'streak-col';
            tdStreak.textContent = calculateStreak(habit.id);
            tr.appendChild(tdStreak);

            for (let day = 1; day <= daysInMonth; day++) {
                const tdDay = document.createElement('td');
                tdDay.className = 'day-cell';
                if (isToday(selectedYear, selectedMonth, day)) tdDay.classList.add('col-today');

                const dateKey = formatDateKey(selectedYear, selectedMonth, day);
                const isChecked = userData.records[dateKey] && userData.records[dateKey].includes(habit.id);
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'habit-checkbox';
                checkbox.tabIndex = -1;
                checkbox.checked = isChecked;
                
                checkbox.addEventListener('change', (e) => {
                    handleCheckboxToggle(dateKey, habit.id, e.target.checked);
                });

                tdDay.appendChild(checkbox);
                tr.appendChild(tdDay);
            }
            gridBody.appendChild(tr);
        });

        calculateAnalytics(habits, daysInMonth);
    }

    async function handleCheckboxToggle(dateKey, habitId, isChecked) {
        ensureNotificationPermission();
        if (!userData.records[dateKey]) userData.records[dateKey] = [];
        if (isChecked) {
            if (!userData.records[dateKey].includes(habitId)) userData.records[dateKey].push(habitId);
        } else {
            userData.records[dateKey] = userData.records[dateKey].filter(id => id !== habitId);
        }
        
        renderDashboard(); // Optimistic Update for instant feel
        await saveDataToFirebase(); // Background Sync
    }

    function calculateAnalytics(habits, daysInMonth) {
        let totalCompletionsThisMonth = 0;
        let totalExpectedThisMonth = habits.length * daysInMonth;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = formatDateKey(selectedYear, selectedMonth, day);
            if (userData.records[dateKey]) {
                const validCompletions = userData.records[dateKey].filter(id => habits.find(h => h.id === id)).length;
                totalCompletionsThisMonth += validCompletions;
            }
        }
        const goalPct = totalExpectedThisMonth === 0 ? 0 : Math.round((totalCompletionsThisMonth / totalExpectedThisMonth) * 100);
        
        let weeklyCompletions = 0;
        let weeklyExpected = habits.length * 7;
        let weeklyDataPoints = [];
        let labels = [];

        const dBase = new Date();
        dBase.setDate(dBase.getDate() - 6);

        for(let i=0; i<7; i++) {
            const dk = formatDateKey(dBase.getFullYear(), dBase.getMonth(), dBase.getDate());
            labels.push(dBase.toLocaleDateString('en-US', { weekday: 'short' }));
            
            let dayCompletions = 0;
            if (userData.records[dk]) {
                dayCompletions = userData.records[dk].filter(id => habits.find(h => h.id === id)).length;
            }
            weeklyCompletions += dayCompletions;
            weeklyDataPoints.push(dayCompletions);
            dBase.setDate(dBase.getDate() + 1);
        }

        const weeklyPct = weeklyExpected === 0 ? 0 : Math.round((weeklyCompletions / weeklyExpected) * 100);
        updateProgressBars(goalPct, weeklyPct);
        renderChart(labels, weeklyDataPoints, habits.length);
    }

    function updateProgressBars(goalPct, weeklyPct) {
        statGoalPct.textContent = `${goalPct}%`;
        statGoalFill.style.width = `${goalPct}%`;
        statWeeklyPct.textContent = `${weeklyPct}%`;
        statWeeklyFill.style.width = `${weeklyPct}%`;
    }

    function renderChart(labels, dataPoints, maxPossible) {
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        if (weeklyChartInstance) weeklyChartInstance.destroy();

        weeklyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completed',
                    data: dataPoints,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, '#6366f1');
                        gradient.addColorStop(1, '#4F46E5');
                        return gradient;
                    },
                    borderRadius: 4,
                    borderWidth: 0,
                    hoverBackgroundColor: '#818cf8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: maxPossible > 0 ? maxPossible : 1,
                        ticks: { stepSize: 1, color: '#8B9BB4' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
                    },
                    x: {
                        ticks: { color: '#8B9BB4' },
                        grid: { display: false, drawBorder: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#131A2A',
                        titleColor: '#FFFFFF',
                        bodyColor: '#FFFFFF',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                }
            }
        });
    }

    let editingHabitId = null;
    document.getElementById('edit-habit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('edit-habit-name').value.trim();
        if (newName && editingHabitId) {
            const hb = userData.habits.find(h => h.id === editingHabitId);
            if (hb) hb.name = newName;
            
            closeSheets();
            renderDashboard();
            await saveDataToFirebase();
        }
    });

    document.getElementById('delete-habit-btn').addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete this habit? All progress for it will be lost.")) {
            userData.habits = userData.habits.filter(h => h.id !== editingHabitId);
            closeSheets();
            renderDashboard();
            await saveDataToFirebase();
        }
    });

    function populateMonthSelector() {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const maxYear = new Date().getFullYear();
        let optionsHtml = '';

        for (let y = maxYear; y >= maxYear - 1; y--) {
            for (let m = 11; m >= 0; m--) {
                const val = `${y}-${m}`;
                const label = `${months[m]} ${y}`;
                const selected = (y === maxYear && m === new Date().getMonth()) ? 'selected' : '';
                optionsHtml += `<option value="${val}" ${selected}>${label}</option>`;
            }
        }
        monthSelect.innerHTML = optionsHtml;
    }

    // ===================================
    // Notification System (Engine Optimized for Mobile)
    // ===================================
    function initNotificationSystem() {
        if (!("Notification" in window)) return;
        
        setInterval(checkPushNotification, 60000);
        checkPushNotification();
    }

    function checkPushNotification() {
        if (Notification.permission !== "granted") return;

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        const schedules = [
            { h: 9, m: 0, title: "Morning Motivation ☀️", body: "Rise and shine! Ready to crush your habits today?" },
            { h: 12, m: 0, title: "Midday Check-in 🥗", body: "Halfway through the day! How are your goals looking?" },
            { h: 15, m: 0, title: "Afternoon Boost ⚡", body: "Stay focused! You're doing great." },
            { h: 19, m: 30, title: "Evening Wrap-up 🌙", body: "Time to start winding down. Did you complete your habits?" },
            { h: 20, m: 0, title: "Nightly Reflection ✨", body: "Reflect on your wins today. Mark your progress!" },
            { h: 21, m: 0, title: "Final Call ⏰", body: "Don't forget to mark your habits before the day ends!" },
            { h: 22, m: 50, title: "Late Night Check-in 🕙", body: "It's 10:50 PM. Have you marked all your habits for today?" },
            { h: 23, m: 0, title: "Day End Review 🌙", body: "11:00 PM is here. Don't let your streak break! Mark your habits now." },
            { h: 23, m: 15, title: "Nightly Nudge 🌙", body: "It's 11:15 PM. Just a quick reminder to check your progress!" },
            { h: 23, m: 20, title: "Final Reflection ✨", body: "11:20 PM. Almost time for bed! Have you updated your habit tracker?" },
            { h: 23, m: 30, title: "Last Call 🌙", body: "It's 11:30 PM. One last look at your habits before the day ends!" }
        ];

        schedules.forEach(schedule => {
            if (hours === schedule.h && minutes === schedule.m) {
                triggerDailyReminder(schedule.title, schedule.body);
            }
        });
    }

    function triggerDailyReminder(title, body) {
        const todayStr = new Date().toDateString() + title;
        const lastNotified = localStorage.getItem('lastHabitNotify_' + title);

        if (lastNotified !== todayStr) {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, {
                        body: body,
                        icon: "favicon.svg",
                        badge: "favicon.svg"
                    });
                    localStorage.setItem('lastHabitNotify_' + title, todayStr);
                });
            } else {
                new Notification(title, { body: body, icon: "favicon.svg" });
                localStorage.setItem('lastHabitNotify_' + title, todayStr);
            }
        }
    }

    // ===================================
    // Timer & Push Notifications
    // ===================================
    let timerInterval = null;
    let timeRemaining = 25 * 60; // 25 mins by default
    const timerDisplay = document.getElementById('timer-display');

    function updateTimerDisplay() {
        if(!timerDisplay) return;
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateTimerDisplay(); // Initial call to sync UI with state

    const timerStartBtn = document.getElementById('timer-start');
    if(timerStartBtn) {
        timerStartBtn.addEventListener('click', () => {
            ensureNotificationPermission();
            if (!timerInterval && timeRemaining > 0) {
                timerInterval = setInterval(() => {
                    timeRemaining--;
                    updateTimerDisplay();
                    if (timeRemaining <= 0) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                        triggerTimerNotification();
                    }
                }, 1000);
            }
        });

        document.getElementById('timer-pause').addEventListener('click', () => {
            clearInterval(timerInterval);
            timerInterval = null;
        });

        document.getElementById('timer-reset').addEventListener('click', () => {
            clearInterval(timerInterval);
            timerInterval = null;
            timeRemaining = 25 * 60;
            updateTimerDisplay();
        });

        document.querySelectorAll('.timer-presets button[data-time]').forEach(b => {
            b.addEventListener('click', (e) => {
                clearInterval(timerInterval);
                timerInterval = null;
                timeRemaining = parseInt(e.target.dataset.time) * 60;
                updateTimerDisplay();
            });
        });

        const customSetBtn = document.getElementById('timer-custom-set');
        if (customSetBtn) {
            customSetBtn.addEventListener('click', () => {
                const minInput = document.getElementById('custom-timer-min');
                const val = parseInt(minInput.value);
                if (val && val > 0 && val < 6000) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    timeRemaining = val * 60;
                    updateTimerDisplay();
                } else {
                    alert("Please enter a valid number of minutes (1-5999).");
                }
            });
        }
    }

    function triggerTimerNotification() {
        const title = "Time's Up! 🚀";
        const body = "Your study timer has finished. Take a break or start a new session!";
        
        if ("Notification" in window && Notification.permission === "granted") {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, { body, icon: "favicon.svg" });
                });
            } else {
                new Notification(title, { body, icon: "favicon.svg" });
            }
        } else {
            alert(body);
        }
        
        // Vibrate if supported
        if("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200, 100, 500]);
        }
    }
});
