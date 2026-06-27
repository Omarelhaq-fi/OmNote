// Core State & App Logic
let db = {
    documents: [],
    rems: [],
    flashcardsQueue: [],
    sections: []
};

let activeDocId = null;

async function initApp(user) {
    if (!user) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-wrapper').style.display = 'none';
        return;
    }

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';

    let cloudDb = null;
    if (window.loadDbFromCloud) {
        cloudDb = await window.loadDbFromCloud();
    }

    if (cloudDb) {
        db = cloudDb;
    } else {
        const docId = generateId();
        const defaultSubject = 's1';
        db.documents = [];
        db.rems = [];
        db.flashcardsQueue = [];
        db.sections = [];
        db.subjects = [{ id: 's1', name: 'General' }];
        db.studyStats = {};

        db.documents.push({ id: docId, title: 'Welcome to OmNote', created: Date.now(), pdfContextText: "", sections: [], subjectId: defaultSubject });

        if (window.addRem) {
            window.addRem(docId, "Welcome to OmNote! Your unified learning environment.", 0);
            window.addRem(docId, "Create flashcards instantly using == syntax.", 0);
        }
        saveDb();
    }

    // Ensure backwards compatibility
    if (!db.subjects) {
        db.subjects = [{ id: 's1', name: 'General' }];
    }
    if (!db.studyStats) {
        db.studyStats = {};
    }
    db.documents.forEach(d => {
        if (!d.sections) d.sections = [];
        if (d.pdfContextText === undefined) d.pdfContextText = "";
        if (!d.subjectId) d.subjectId = db.subjects[0].id;
    });

    // Make refreshAppUI global if not already, and call it
    window.refreshAppUI = refreshAppUI;
    if (activeDocId) {
        refreshAppUI();
    } else {
        window.showHomeView();
    }
}

function saveDb() {
    if (window.firebase && firebase.auth().currentUser && window.syncDbToCloud) {
        window.syncDbToCloud(db);
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Sidebar Logic
window.toggleSidebar = function () {
    document.getElementById('sidebar-overlay').classList.toggle('active');
    document.getElementById('sidebar-menu').classList.toggle('active');
}

window.toggleRightPane = function () {
    const rightPane = document.getElementById('right-pane');
    if (rightPane) {
        rightPane.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-closed', rightPane.classList.contains('collapsed'));
    }
}

window.toggleFullScreen = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

window.createNewDocument = function () {
    const docId = generateId();
    const subjectId = db.subjects && db.subjects.length > 0 ? db.subjects[0].id : 's1';
    db.documents.push({ id: docId, title: 'Untitled Document', created: Date.now(), pdfContextText: "", sections: [], subjectId });
    activeDocId = docId;
    window.addRem(docId, "", 0); // initial rem
    saveDb();
    refreshAppUI();
    toggleSidebar();
}

window.deleteDocument = function (docId) {
    if (!confirm("Are you sure you want to delete this document and all its notes?")) return;

    db.documents = db.documents.filter(d => d.id !== docId);
    db.rems = db.rems.filter(r => r.docId !== docId);

    saveDb();

    if (activeDocId === docId) {
        if (db.documents.length === 0) {
            window.createNewDocument();
        } else {
            window.switchDocument(db.documents[0].id);
        }
    } else {
        if (!activeDocId) {
            window.showHomeView();
        } else {
            refreshAppUI();
        }
    }
}

window.createNewSubject = function () {
    const name = prompt("Enter new subject name:");
    if (!name) return;
    db.subjects.push({ id: generateId(), name });
    saveDb();
    refreshAppUI();
}

window.moveDocument = function (docId) {
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) return;

    let promptText = "Enter the number of the subject to move this document to:\n";
    db.subjects.forEach((s, idx) => {
        promptText += `${idx + 1}. ${s.name}\n`;
    });

    const choice = prompt(promptText);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (!isNaN(idx) && db.subjects[idx]) {
        doc.subjectId = db.subjects[idx].id;
        saveDb();
        refreshAppUI();
    } else {
        alert("Invalid subject selection.");
    }
}

window.getActiveDoc = function () {
    return db.documents.find(d => d.id === activeDocId);
}

window.showHomeView = function () {
    activeDocId = null;
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('workspace').style.display = 'none';

    if (document.getElementById('top-doc-title-group')) document.getElementById('top-doc-title-group').style.display = 'none';
    const navTabs = document.getElementById('main-nav-tabs');
    if (navTabs) navTabs.style.display = 'none';

    const grid = document.getElementById('home-subjects-grid');
    if (grid) {
        grid.innerHTML = '';
        if (db.subjects) {
            db.subjects.forEach(subject => {
                const docs = db.documents.filter(d => d.subjectId === subject.id);
                if (docs.length === 0) return;

                const group = document.createElement('div');
                group.className = 'home-subject-label';
                group.innerHTML = `📁 ${subject.name}`;
                grid.appendChild(group);

                docs.forEach((doc, dIdx) => {
                    const now = Date.now();
                    const dueCount = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === doc.id).length;
                    const dueBadge = dueCount > 0 ? `<div class="due-badge">${dueCount} Due</div>` : '';

                    const card = document.createElement('div');
                    card.className = 'home-doc-card';
                    card.style.animationDelay = `${dIdx * 0.06}s`;
                    card.onclick = () => window.switchDocument(doc.id);

                    card.innerHTML = `
                        ${dueBadge}
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div class="doc-card-title" style="margin-bottom: 0;">📄 ${doc.title}</div>
                            <button onclick="event.stopPropagation(); window.deleteDocument('${doc.id}');" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; padding: 0 0 0 10px;" title="Delete Document">🗑️</button>
                        </div>
                        <div class="doc-card-meta" style="margin-top: 8px;">Created: ${new Date(doc.created).toLocaleDateString()}</div>
                    `;
                    grid.appendChild(card);
                });
            });
        }
    }

    refreshAppUI();
}

window.switchDocument = function (docId) {
    activeDocId = docId;

    document.getElementById('home-view').style.display = 'none';
    document.getElementById('workspace').style.display = 'flex';

    if (document.getElementById('top-doc-title-group')) document.getElementById('top-doc-title-group').style.display = 'block';
    const navTabs = document.getElementById('main-nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';

    // Switch to notes view by default on new doc
    const leftTabs = document.querySelectorAll('#left-pane-tabs .left-tab-item');
    if (leftTabs.length >= 3) {
        window.switchLeftView('notes-view', leftTabs[2]);
    }

    const iframe = document.getElementById('pdf-iframe');
    if (iframe) iframe.src = '';

    const summaryContent = document.getElementById('summary-content');
    if (summaryContent) {
        summaryContent.innerHTML = '<div style="color: var(--text-muted); margin-top: 50px; text-align: center;">Click "Read Summary" on a topic in your Study Plan to generate a detailed summary.</div>';
    }

    refreshAppUI();
    if (window.renderAccordionSections) window.renderAccordionSections();
    toggleSidebar();
}

window.updateDocTitle = function (newTitle) {
    if (!activeDocId) return;
    const doc = db.documents.find(d => d.id === activeDocId);
    if (doc) {
        doc.title = newTitle;
        saveDb();
        refreshAppUI();
    }
}

function refreshAppUI() {
    // Render sidebar list
    const list = document.getElementById('document-list');
    if (list) {
        list.innerHTML = '';

        if (db.subjects) {
            db.subjects.forEach(subject => {
                const subHeader = document.createElement('div');
                subHeader.className = 'sidebar-section-label';
                subHeader.style.marginTop = '15px';
                subHeader.innerText = `📁 ${subject.name}`;
                list.appendChild(subHeader);

                const docs = db.documents.filter(d => d.subjectId === subject.id);
                docs.forEach(doc => {
                    const now = Date.now();
                    const dueCount = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === doc.id).length;
                    const dueBadge = dueCount > 0 ? `<span style="background: rgba(244,63,94,0.15); color: var(--accent-rose); font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; margin-left: 8px; font-weight: 700;">${dueCount}</span>` : '';

                    const item = document.createElement('div');
                    item.className = `doc-list-item ${doc.id === activeDocId ? 'active' : ''}`;
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    item.innerHTML = `
                        <div style="flex:1; cursor:pointer;" onclick="window.switchDocument('${doc.id}')">📄 ${doc.title}${dueBadge}</div>
                        <div style="display:flex; gap:8px; opacity:${doc.id === activeDocId ? 1 : 0.4};">
                            <button style="background:transparent; border:none; color:var(--text-primary); cursor:pointer; font-size:1rem;" onclick="window.moveDocument('${doc.id}')" title="Move Document">📁</button>
                            <button style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem;" onclick="window.deleteDocument('${doc.id}')" title="Delete Document">🗑️</button>
                        </div>
                    `;
                    list.appendChild(item);
                });
            });
        }
    }

    // Update Topbar and Note title
    const doc = db.documents.find(d => d.id === activeDocId);
    if (doc) {
        document.getElementById('top-doc-title').innerText = doc.title;
        const input = document.getElementById('doc-title-input');
        if (input) input.value = doc.title;
    }

    // Update Rems
    if (window.renderRems) window.renderRems();

    // Update stats
    const mastered = db.rems.filter(r => r.isFlashcard && r.ease >= 2.6 && r.docId === activeDocId).length;
    if (document.getElementById('stat-mastered')) document.getElementById('stat-mastered').innerText = mastered;

    // Calculate Study Stats
    if (db.studyStats && document.getElementById('stat-today')) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        let todaySec = db.studyStats[todayStr] || 0;
        let weekSec = 0;
        let monthSec = 0;

        const dayMs = 24 * 60 * 60 * 1000;
        // Week starts on Sunday
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        for (const [dateStr, sec] of Object.entries(db.studyStats)) {
            const dateObj = new Date(dateStr);
            const t = dateObj.getTime();
            if (t >= startOfWeek) weekSec += sec;
            if (t >= startOfMonth) monthSec += sec;
        }

        const formatSecs = (s) => {
            const hrs = Math.floor(s / 3600);
            const mins = Math.floor((s % 3600) / 60);
            if (hrs > 0) return `${hrs}h ${mins}m`;
            return `${mins}m`;
        };

        document.getElementById('stat-today').innerText = formatSecs(todaySec);
        document.getElementById('stat-week').innerText = formatSecs(weekSec);
        document.getElementById('stat-month').innerText = formatSecs(monthSec);
    }

    updateSRSQueue();
}

// UI Switching (Left Pane) — Updated for new tab structure
window.switchLeftView = function (viewId, tabElement) {
    document.querySelectorAll('.left-view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#left-pane-tabs .left-tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (tabElement) tabElement.classList.add('active');
}

// UI Switching (Right Pane)
window.switchRightView = function (viewId, tabElement) {
    document.querySelectorAll('.right-view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.right-tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (tabElement) tabElement.classList.add('active');
}

// Main Nav Tabs (top center) — handles Study Plan, Summary, AI Tutor, Review
window.switchMainTab = function (tabName, tabElement) {
    // Update active state on nav tabs
    document.querySelectorAll('.main-nav-tab').forEach(el => el.classList.remove('active'));
    tabElement.classList.add('active');

    switch (tabName) {
        case 'study-plan':
            // Focus right pane on study plan
            window.switchRightView('learn-view', document.querySelectorAll('.right-tab-item')[1]);
            break;
        case 'summary':
            // Focus left pane on summary
            window.switchLeftView('summary-view', document.querySelectorAll('#left-pane-tabs .left-tab-item')[1]);
            break;
        case 'ai-tutor':
            // Focus right pane on AI tutor
            window.switchRightView('ai-view', document.querySelectorAll('.right-tab-item')[2]);
            break;
        case 'review':
            // Open review queue
            startReview();
            break;
    }
}

// Modals
window.openModal = function (id) { document.getElementById(id).classList.add('active'); }
window.closeModal = function (id) { document.getElementById(id).classList.remove('active'); }

window.updateSRSQueue = function () {
    if (!activeDocId) return;
    const now = Date.now();
    const due = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === activeDocId);

    // Update nav tab review label
    const navLabel = document.getElementById('nav-review-label');
    if (navLabel) navLabel.innerText = `Review (${due.length})`;
}

// Toggle study plan accordion
window.toggleAccordion = function (headerElement) {
    const item = headerElement.parentElement;
    item.classList.toggle('expanded');
    const rightSpan = headerElement.querySelector('.header-right');
    if (item.classList.contains('expanded')) {
        rightSpan.innerHTML = '<span class="progress-badge">0%</span> ⌃';
    } else {
        rightSpan.innerHTML = '<span class="progress-badge">0%</span> ⌄';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.firebase && firebase.auth) {
        const unsubscribe = firebase.auth().onAuthStateChanged(user => {
            unsubscribe();
            initApp(user);
        });

        // Listen for subsequent changes to update UI
        firebase.auth().onAuthStateChanged(user => {
            initApp(user);
        });
    } else {
        initApp(null);
    }
});

// CSV Upload Logic
window.handleCsvUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        
        const parseCSV = (str) => {
            const result = [];
            let row = [];
            let inQuotes = false;
            let val = '';
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                if (char === '"') {
                    if (inQuotes && str[i+1] === '"') {
                        val += '"'; // escaped quote
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === '|' && !inQuotes) {
                    row.push(val);
                    val = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (char === '\r' && str[i+1] === '\n') i++;
                    row.push(val);
                    result.push(row);
                    row = [];
                    val = '';
                } else {
                    val += char;
                }
            }
            if (val || row.length > 0) {
                row.push(val);
                result.push(row);
            }
            return result;
        };

        const rows = parseCSV(text);
        
        const docId = generateId();
        const subjectId = db.subjects && db.subjects.length > 0 ? db.subjects[0].id : 's1';
        const docTitle = file.name.replace('.csv', '');
        
        db.documents.push({ id: docId, title: docTitle, created: Date.now(), pdfContextText: "", sections: [], subjectId });
        
        let count = 0;
        rows.forEach(parts => {
            // Filter empty rows
            if (parts.length === 1 && !parts[0].trim()) return;
            
            if (parts.length >= 2) {
                const front = parts[0].trim();
                const back = parts.slice(1).join('|').trim();
                if (front || back) {
                    window.addRem(docId, `${front} == ${back}`, 0);
                    count++;
                }
            } else if (parts.length === 1) {
                // Just a note
                if (parts[0].trim()) {
                    window.addRem(docId, parts[0].trim(), 0);
                    count++;
                }
            }
        });
        
        if (count === 0) {
            window.addRem(docId, "No valid flashcards found in CSV.", 0);
        }
        
        saveDb();
        window.switchDocument(docId);
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Auth Logic
window.openAuthModal = function () {
    window.openModal('auth-modal');
}

// Auth Logic
window.handleLogin = async function () {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const err = document.getElementById('auth-error');
    err.style.display = 'none';

    try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        initApp(firebase.auth().currentUser);
    } catch (e) {
        err.innerText = e.message;
        err.style.display = 'block';
    }
}

window.handleRegister = async function () {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const err = document.getElementById('auth-error');
    err.style.display = 'none';

    try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
        // Migration logic
        const localData = localStorage.getItem('omnote_db_v2');
        if (localData) {
            db = JSON.parse(localData);
            saveDb();
        }
        initApp(firebase.auth().currentUser);
        alert("Account created!");
    } catch (e) {
        err.innerText = e.message;
        err.style.display = 'block';
    }
}

window.handleLogout = async function () {
    await firebase.auth().signOut();
    initApp(null);
}

// Global Loading Screen Logic
let loadingInterval = null;
const funMessages = [
    "Brewing some intelligence...",
    "Reading the whole textbook in 3 seconds...",
    "Double-checking the facts...",
    "Cross-referencing the universe...",
    "Analyzing semantic structures...",
    "Reticulating splines...",
    "Connecting the neural pathways...",
    "Synthesizing knowledge...",
    "Preparing your premium study materials..."
];

window.showLoadingScreen = function(title = "Generating...") {
    const overlay = document.getElementById('global-loading-overlay');
    const titleEl = document.getElementById('loading-title');
    const textEl = document.getElementById('loading-text');
    const progressFill = document.querySelector('.progress-bar-fill');
    
    if(!overlay || !titleEl || !textEl || !progressFill) return;
    
    titleEl.innerText = title;
    overlay.style.display = 'flex';
    
    // Simulate progress bar
    progressFill.style.width = '0%';
    setTimeout(() => progressFill.style.width = '30%', 100);
    setTimeout(() => progressFill.style.width = '70%', 3000);
    setTimeout(() => progressFill.style.width = '90%', 8000);
    
    let msgIndex = 0;
    textEl.style.opacity = 0;
    setTimeout(() => {
        textEl.innerText = funMessages[msgIndex];
        textEl.style.opacity = 1;
    }, 300);

    if(loadingInterval) clearInterval(loadingInterval);
    loadingInterval = setInterval(() => {
        textEl.style.opacity = 0;
        setTimeout(() => {
            msgIndex = (msgIndex + 1) % funMessages.length;
            textEl.innerText = funMessages[msgIndex];
            textEl.style.opacity = 1;
        }, 300);
    }, 3500);
}

window.hideLoadingScreen = function() {
    const overlay = document.getElementById('global-loading-overlay');
    const progressFill = document.querySelector('.progress-bar-fill');
    
    if(!overlay || !progressFill) return;
    
    if(loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    
    progressFill.style.width = '100%';
    setTimeout(() => {
        overlay.style.display = 'none';
        progressFill.style.width = '0%';
    }, 300);
}

// Settings Modal Logic
window.openApiSettingsModal = function() {
    window.renderApiKeysList();
    window.openModal('api-settings-modal');
}

window.renderApiKeysList = function() {
    const listEl = document.getElementById('api-keys-list');
    if (!listEl) return;
    
    // Using global GEMINI_API_KEYS from ai.js
    if (!window.GEMINI_API_KEYS || window.GEMINI_API_KEYS.length === 0 || (window.GEMINI_API_KEYS.length === 1 && window.GEMINI_API_KEYS[0] === "")) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size: 0.85rem;">No API keys added yet.</div>';
        return;
    }

    listEl.innerHTML = '';
    window.GEMINI_API_KEYS.forEach((key, index) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '10px';
        item.style.background = 'rgba(255,255,255,0.03)';
        item.style.border = '1px solid var(--border-medium)';
        item.style.borderRadius = '6px';
        
        const keyDisplay = document.createElement('div');
        keyDisplay.style.fontFamily = 'monospace';
        keyDisplay.style.fontSize = '0.85rem';
        keyDisplay.innerText = key.length > 15 ? key.substring(0, 10) + '...' + key.substring(key.length - 4) : key;
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        
        const testBtn = document.createElement('button');
        testBtn.innerText = 'Test';
        testBtn.className = 'btn-dark-pill';
        testBtn.onclick = () => window.handleTestApiKey(key, index);
        
        const delBtn = document.createElement('button');
        delBtn.innerText = 'Delete';
        delBtn.className = 'btn-dark-pill';
        delBtn.style.color = 'var(--accent-rose)';
        delBtn.onclick = () => window.handleRemoveApiKey(index);
        
        btnGroup.appendChild(testBtn);
        btnGroup.appendChild(delBtn);
        
        item.appendChild(keyDisplay);
        item.appendChild(btnGroup);
        
        listEl.appendChild(item);
    });
}

window.handleAddApiKey = function() {
    const input = document.getElementById('new-api-key-input');
    const resultEl = document.getElementById('api-key-test-result');
    const val = input.value.trim();
    if (!val) return;
    
    if (window.addApiKey(val)) {
        input.value = '';
        window.renderApiKeysList();
        resultEl.innerText = "Key added successfully.";
        resultEl.style.color = "var(--accent-emerald)";
    } else {
        resultEl.innerText = "Key already exists.";
        resultEl.style.color = "var(--accent-rose)";
    }
}

window.handleRemoveApiKey = function(index) {
    if (confirm("Remove this API key?")) {
        window.removeApiKey(index);
        window.renderApiKeysList();
        document.getElementById('api-key-test-result').innerText = '';
    }
}

window.handleTestApiKey = async function(key, index) {
    const resultEl = document.getElementById('api-key-test-result');
    resultEl.innerText = `Testing key #${index + 1}...`;
    resultEl.style.color = "var(--text-secondary)";
    
    const res = await window.testApiKey(key);
    if (res.success) {
        resultEl.innerText = `Key #${index + 1} is working correctly!`;
        resultEl.style.color = "var(--accent-emerald)";
    } else {
        resultEl.innerText = `Key #${index + 1} failed: ${res.message}`;
        resultEl.style.color = "var(--accent-rose)";
    }
}