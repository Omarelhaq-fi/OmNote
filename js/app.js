// Core State & App Logic
let db = {
    documents: [],
    rems: [],
    flashcardsQueue: [],
    sections: [] 
};

let activeDocId = null;

async function initApp() {
    let cloudDb = null;
    if (window.loadDbFromCloud) {
        cloudDb = await window.loadDbFromCloud();
    }
    
    if (cloudDb) {
        db = cloudDb;
        // activeDocId left null by default to show home screen
    } else {
        const saved = localStorage.getItem('omnote_db_v2');
        if (saved) {
            db = JSON.parse(saved);
        } else {
            const docId = generateId();
            const defaultSubject = 's1';
            db.documents.push({ id: docId, title: 'Welcome to OmNote', created: Date.now(), pdfContextText: "", sections: [], subjectId: defaultSubject });
            
            if (window.addRem) {
                window.addRem(docId, "Welcome to OmNote! Your unified learning environment.", 0);
                window.addRem(docId, "Create flashcards instantly using == syntax.", 0);
            }
            saveDb();
        }
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
    localStorage.setItem('omnote_db_v2', JSON.stringify(db));
    if (window.syncDbToCloud) {
        window.syncDbToCloud(db);
    }
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Sidebar Logic
window.toggleSidebar = function() {
    document.getElementById('sidebar-overlay').classList.toggle('active');
    document.getElementById('sidebar-menu').classList.toggle('active');
}

window.createNewDocument = function() {
    const docId = generateId();
    const subjectId = db.subjects && db.subjects.length > 0 ? db.subjects[0].id : 's1';
    db.documents.push({ id: docId, title: 'Untitled Document', created: Date.now(), pdfContextText: "", sections: [], subjectId });
    activeDocId = docId;
    window.addRem(docId, "", 0); // initial rem
    saveDb();
    refreshAppUI();
    toggleSidebar();
}

window.deleteDocument = function(docId) {
    if(!confirm("Are you sure you want to delete this document and all its notes?")) return;
    
    db.documents = db.documents.filter(d => d.id !== docId);
    db.rems = db.rems.filter(r => r.docId !== docId);
    
    if (db.documents.length === 0) {
        window.createNewDocument();
    } else {
        window.switchDocument(db.documents[0].id);
    }
    saveDb();
}

window.createNewSubject = function() {
    const name = prompt("Enter new subject name:");
    if (!name) return;
    db.subjects.push({ id: generateId(), name });
    saveDb();
    refreshAppUI();
}

window.moveDocument = function(docId) {
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

window.getActiveDoc = function() {
    return db.documents.find(d => d.id === activeDocId);
}

window.showHomeView = function() {
    activeDocId = null;
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('workspace').style.display = 'none';
    
    if(document.getElementById('top-doc-title-group')) document.getElementById('top-doc-title-group').style.display = 'none';
    const mainTabs = document.querySelector('.topbar-right .main-tabs');
    if (mainTabs) mainTabs.style.display = 'none';
    const btnReview = document.getElementById('btn-review-queue');
    if (btnReview) btnReview.style.display = 'none';
    
    const grid = document.getElementById('home-subjects-grid');
    if (grid) {
        grid.innerHTML = '';
        if (db.subjects) {
            db.subjects.forEach(subject => {
                const docs = db.documents.filter(d => d.subjectId === subject.id);
                if (docs.length === 0) return;
                
                const group = document.createElement('div');
                group.style.gridColumn = '1 / -1';
                group.style.marginTop = '10px';
                group.innerHTML = `<h3 style="color: var(--text-muted); text-transform: uppercase; font-size: 0.85rem; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">📁 ${subject.name}</h3>`;
                grid.appendChild(group);
                
                docs.forEach(doc => {
                    const now = Date.now();
                    const dueCount = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === doc.id).length;
                    const dueBadge = dueCount > 0 ? `<div style="background: #ef4444; color: white; font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-bottom: 10px; display: inline-block;">${dueCount} Due</div>` : '';
                    
                    const card = document.createElement('div');
                    card.style.background = '#2b2b2b';
                    card.style.border = '1px solid #444';
                    card.style.borderRadius = '12px';
                    card.style.padding = '20px';
                    card.style.cursor = 'pointer';
                    card.style.transition = 'transform 0.2s, border-color 0.2s';
                    card.onmouseover = () => { card.style.borderColor = 'var(--bg-purple)'; card.style.transform = 'translateY(-2px)'; };
                    card.onmouseout = () => { card.style.borderColor = '#444'; card.style.transform = 'none'; };
                    card.onclick = () => window.switchDocument(doc.id);
                    
                    card.innerHTML = `
                        ${dueBadge}
                        <div style="font-weight: bold; font-size: 1.2rem; margin-bottom: 10px; color: #fff;">📄 ${doc.title}</div>
                        <div style="font-size: 0.85rem; color: #888;">Created: ${new Date(doc.created).toLocaleDateString()}</div>
                    `;
                    grid.appendChild(card);
                });
            });
        }
    }
    
    refreshAppUI();
}

window.switchDocument = function(docId) {
    activeDocId = docId;
    
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('workspace').style.display = 'flex';
    
    if(document.getElementById('top-doc-title-group')) document.getElementById('top-doc-title-group').style.display = 'block';
    const mainTabs = document.querySelector('.topbar-right .main-tabs');
    if (mainTabs) mainTabs.style.display = 'flex';
    const btnReview = document.getElementById('btn-review-queue');
    if (btnReview) btnReview.style.display = 'block';
    
    // Switch to notes view by default on new doc
    window.switchLeftView('notes-view', document.querySelectorAll('.topbar-right .main-tabs .tab-item')[2]);
    
    const iframe = document.getElementById('pdf-iframe');
    if(iframe) iframe.src = '';
    
    const summaryContent = document.getElementById('summary-content');
    if (summaryContent) {
        summaryContent.innerHTML = '<div style="color: var(--text-muted); margin-top: 50px; text-align: center;">Click "Read Summary" on a topic in your Study Plan to generate a detailed summary.</div>';
    }
    
    refreshAppUI();
    if (window.renderAccordionSections) window.renderAccordionSections();
    toggleSidebar();
}

window.updateDocTitle = function(newTitle) {
    if(!activeDocId) return;
    const doc = db.documents.find(d => d.id === activeDocId);
    if(doc) {
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
                subHeader.style.padding = '5px 15px';
                subHeader.style.color = 'var(--text-muted)';
                subHeader.style.fontWeight = 'bold';
                subHeader.style.fontSize = '0.75rem';
                subHeader.style.marginTop = '15px';
                subHeader.style.textTransform = 'uppercase';
                subHeader.innerText = `📁 ${subject.name}`;
                list.appendChild(subHeader);
                
                const docs = db.documents.filter(d => d.subjectId === subject.id);
                docs.forEach(doc => {
                    const now = Date.now();
                    const dueCount = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === doc.id).length;
                    const dueBadge = dueCount > 0 ? `<span style="background: #ef4444; color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: bold;">${dueCount}</span>` : '';
                    
                    const item = document.createElement('div');
                    item.className = `doc-list-item ${doc.id === activeDocId ? 'active' : ''}`;
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    item.innerHTML = `
                        <div style="flex:1; cursor:pointer;" onclick="window.switchDocument('${doc.id}')">📄 ${doc.title}${dueBadge}</div>
                        <div style="display:flex; gap:8px; opacity:${doc.id === activeDocId ? 1 : 0.4};">
                            <button style="background:transparent; border:none; color:var(--text-main); cursor:pointer; font-size:1rem;" onclick="window.moveDocument('${doc.id}')" title="Move Document">📁</button>
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
    if(document.getElementById('stat-mastered')) document.getElementById('stat-mastered').innerText = mastered;
    
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

// UI Switching (Left Pane)
window.switchLeftView = function(viewId, tabElement) {
    document.querySelectorAll('.left-view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.topbar-right .main-tabs .tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    tabElement.classList.add('active');
}

// UI Switching (Right Pane)
window.switchRightView = function(viewId, tabElement) {
    document.querySelectorAll('.right-view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.right-tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    tabElement.classList.add('active');
}

// Modals
window.openModal = function(id) { document.getElementById(id).classList.add('active'); }
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); }

window.updateSRSQueue = function() {
    if (!activeDocId) return;
    const now = Date.now();
    const due = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === activeDocId);
    const btn = document.getElementById('btn-review-queue');
    if (btn) btn.innerText = `📚 Review Queue (${due.length})`;
}

// Toggle study plan accordion
window.toggleAccordion = function(headerElement) {
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
    initApp();
});
