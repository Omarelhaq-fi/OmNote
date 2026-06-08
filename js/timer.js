// Pomodoro Timer Logic

let pomoState = 'stopped'; // stopped, work, break
let pomoTimeLeft = 25 * 60;
let pomoInterval = null;

let pomoSettings = {
    work: 25 * 60,
    break: 5 * 60
};

// Load settings
const savedSettings = localStorage.getItem('omnote_pomo_settings');
if (savedSettings) {
    pomoSettings = JSON.parse(savedSettings);
    pomoTimeLeft = pomoSettings.work;
}

window.toggleTimer = function() {
    if (pomoState === 'stopped') {
        startTimer('work');
    } else if (pomoState === 'work') {
        // Pause it
        clearInterval(pomoInterval);
        pomoState = 'stopped';
        updateTimerUI();
    } else if (pomoState === 'break') {
        // Pause it
        clearInterval(pomoInterval);
        pomoState = 'stopped';
        updateTimerUI();
    }
}

window.resetTimer = function() {
    clearInterval(pomoInterval);
    pomoState = 'stopped';
    pomoTimeLeft = pomoSettings.work;
    updateTimerUI();
}

window.openTimerSettings = function() {
    const workMins = prompt("Enter work duration in minutes (e.g. 25, 50, 60):", pomoSettings.work / 60);
    if (!workMins) return;
    const breakMins = prompt("Enter break duration in minutes (e.g. 5, 10):", pomoSettings.break / 60);
    if (!breakMins) return;
    
    pomoSettings.work = parseInt(workMins) * 60 || (25 * 60);
    pomoSettings.break = parseInt(breakMins) * 60 || (5 * 60);
    
    localStorage.setItem('omnote_pomo_settings', JSON.stringify(pomoSettings));
    resetTimer();
}

function startTimer(mode) {
    pomoState = mode;
    if (mode === 'work') {
        if (pomoTimeLeft === pomoSettings.break || pomoTimeLeft === 0) pomoTimeLeft = pomoSettings.work;
    } else if (mode === 'break') {
        pomoTimeLeft = pomoSettings.break;
    }
    
    updateTimerUI();
    
    pomoInterval = setInterval(() => {
        pomoTimeLeft--;
        
        if (pomoState === 'work') {
            trackStudyTime(1);
        }
        
        if (pomoTimeLeft <= 0) {
            clearInterval(pomoInterval);
            if (pomoState === 'work') {
                alert("Work session complete! Time for a break.");
                startTimer('break');
            } else {
                alert("Break is over! Back to work.");
                startTimer('work');
            }
        }
        
        updateTimerUI();
    }, 1000);
}

function trackStudyTime(seconds) {
    if (!db.studyStats) db.studyStats = {};
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (!db.studyStats[todayStr]) {
        db.studyStats[todayStr] = 0;
    }
    db.studyStats[todayStr] += seconds;
    
    // Save DB periodically or rely on other actions.
    // To be safe, save every 60 seconds.
    if (db.studyStats[todayStr] % 60 === 0 && typeof saveDb === 'function') {
        saveDb();
        if (typeof refreshAppUI === 'function') refreshAppUI();
    }
}

function updateTimerUI() {
    const btn = document.getElementById('btn-timer');
    if (!btn) return;
    
    const mins = Math.floor(pomoTimeLeft / 60);
    const secs = pomoTimeLeft % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    let icon = '▶️';
    if (pomoState === 'work') icon = '⏸️ 🧠';
    else if (pomoState === 'break') icon = '⏸️ ☕';
    
    btn.innerHTML = `${icon} ${timeStr}`;
    if (pomoState === 'work') {
        btn.style.color = '#ef4444'; // Red-ish for work
    } else if (pomoState === 'break') {
        btn.style.color = '#22c55e'; // Green for break
    } else {
        btn.style.color = 'var(--text-main)';
    }
}

// Initialize UI
window.addEventListener('DOMContentLoaded', () => {
    updateTimerUI();
});
