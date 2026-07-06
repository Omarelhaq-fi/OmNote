// Editor, Rem, Flashcard & SRS Review Logic

// ============================================================
// ADD REM — Core function to add a rem (note/flashcard) to the db
// ============================================================
window.addRem = function (docId, text, indent, parentId, sourceText, topic) {
    const id = Math.random().toString(36).substr(2, 9);
    const isFlashcard = text.includes('==');

    let front = '';
    let back = '';
    if (isFlashcard) {
        const parts = text.split('==');
        front = parts[0].trim();
        back = parts.slice(1).join('==').trim();
    }

    const rem = {
        id: id,
        docId: docId,
        text: text,
        indent: indent || 0,
        parentId: parentId || null,
        isFlashcard: isFlashcard,
        front: front,
        back: back,
        sourceText: sourceText || '',
        topic: topic || null,
        ease: 2.5,
        interval: 0,
        nextReview: isFlashcard ? Date.now() : 0,
        created: Date.now()
    };

    db.rems.push(rem);
    return rem;
};

// ============================================================
// RENDER REMS — Renders the outliner-style editor in the notes view
// ============================================================
window.renderRems = function () {
    const container = document.getElementById('editor-container');
    if (!container || !activeDocId) return;

    const docRems = db.rems.filter(r => r.docId === activeDocId);
    container.innerHTML = '';

    if (docRems.length === 0) {
        // Add a blank rem so the editor isn't empty
        window.addRem(activeDocId, '', 0);
        if (typeof saveDb === 'function') saveDb();
        window.renderRems();
        return;
    }

    docRems.forEach((rem, idx) => {
        const row = document.createElement('div');
        row.className = 'rem-row';
        row.style.paddingLeft = (rem.indent * 24) + 'px';
        row.setAttribute('data-rem-id', rem.id);
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '6px';
        row.style.marginBottom = '2px';
        row.style.position = 'relative';
        row.style.animation = 'fadeIn 0.15s ease';

        // Bullet
        const bullet = document.createElement('div');
        bullet.style.width = '6px';
        bullet.style.height = '6px';
        bullet.style.borderRadius = '50%';
        bullet.style.marginTop = '10px';
        bullet.style.flexShrink = '0';
        bullet.style.transition = 'all 0.2s';

        if (rem.isFlashcard) {
            bullet.style.background = 'var(--accent-amber)';
            bullet.style.boxShadow = '0 0 6px rgba(245,158,11,0.4)';
        } else {
            bullet.style.background = 'var(--text-dim)';
        }

        // Input
        const input = document.createElement('div');
        input.contentEditable = true;
        input.className = 'rem-input';
        input.style.flex = '1';
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.color = 'var(--text-primary)';
        input.style.outline = 'none';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = '0.95rem';
        input.style.lineHeight = '1.6';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
        input.style.transition = 'background 0.2s';
        input.style.minHeight = '28px';
        input.style.wordBreak = 'break-word';

        // Render flashcard text with highlighting
        if (rem.isFlashcard && rem.front && rem.back) {
            input.innerHTML = `<span style="color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(rem.front)}</span><span style="color: var(--accent-amber); font-weight: 600;"> == </span><span style="color: var(--accent-cyan); white-space: pre-wrap;">${escapeHtml(rem.back)}</span>`;
        } else {
            input.textContent = rem.text;
        }

        // Focus styling
        input.addEventListener('focus', () => {
            input.style.background = 'rgba(255,255,255,0.03)';
            input.textContent = rem.text; // switch to plain text on edit
        });

        input.addEventListener('blur', () => {
            input.style.background = 'transparent';
            const newText = input.textContent || input.innerText;
            if (newText !== rem.text) {
                rem.text = newText;
                rem.isFlashcard = newText.includes('==');
                if (rem.isFlashcard) {
                    const parts = newText.split('==');
                    rem.front = parts[0].trim();
                    rem.back = parts.slice(1).join('==').trim();
                    if (!rem.nextReview || rem.nextReview === 0) {
                        rem.nextReview = Date.now();
                    }
                    bullet.style.background = 'var(--accent-amber)';
                    bullet.style.boxShadow = '0 0 6px rgba(245,158,11,0.4)';
                } else {
                    rem.front = '';
                    rem.back = '';
                    bullet.style.background = 'var(--text-dim)';
                    bullet.style.boxShadow = 'none';
                }
                if (typeof saveDb === 'function') saveDb();
                if (typeof updateSRSQueue === 'function') updateSRSQueue();
            }
            // Re-render flashcard highlighting
            if (rem.isFlashcard && rem.front && rem.back) {
                input.innerHTML = `<span style="color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(rem.front)}</span><span style="color: var(--accent-amber); font-weight: 600;"> == </span><span style="color: var(--accent-cyan); white-space: pre-wrap;">${escapeHtml(rem.back)}</span>`;
            }
        });

        // Keyboard: Enter to add new rem, Tab/Shift+Tab for indent
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newRem = window.addRem(activeDocId, '', rem.indent);
                // Insert after current rem
                const currentIdx = db.rems.indexOf(rem);
                const newRemObj = db.rems.pop(); // remove from end
                db.rems.splice(currentIdx + 1, 0, newRemObj); // insert after current
                if (typeof saveDb === 'function') saveDb();
                window.renderRems();
                // Focus on new rem
                setTimeout(() => {
                    const newRow = document.querySelector(`[data-rem-id="${newRem.id}"] .rem-input`);
                    if (newRow) newRow.focus();
                }, 50);
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    rem.indent = Math.max(0, rem.indent - 1);
                } else {
                    rem.indent = Math.min(5, rem.indent + 1);
                }
                if (typeof saveDb === 'function') saveDb();
                window.renderRems();
            }

            if (e.key === 'Backspace' && (input.textContent || input.innerText).trim() === '') {
                e.preventDefault();
                if (docRems.length > 1) {
                    db.rems = db.rems.filter(r => r.id !== rem.id);
                    if (typeof saveDb === 'function') saveDb();
                    window.renderRems();
                    // Focus previous rem
                    const prevIdx = Math.max(0, idx - 1);
                    setTimeout(() => {
                        const inputs = container.querySelectorAll('.rem-input');
                        if (inputs[prevIdx]) inputs[prevIdx].focus();
                    }, 50);
                }
            }
        });

        // Delete button (visible on hover)
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.style.background = 'transparent';
        delBtn.style.border = 'none';
        delBtn.style.color = 'var(--text-dim)';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '1rem';
        delBtn.style.padding = '4px 6px';
        delBtn.style.borderRadius = '4px';
        delBtn.style.opacity = '0';
        delBtn.style.transition = 'all 0.2s';

        row.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; });
        row.addEventListener('mouseleave', () => { delBtn.style.opacity = '0'; });

        delBtn.addEventListener('click', () => {
            if (docRems.length > 1) {
                db.rems = db.rems.filter(r => r.id !== rem.id);
                if (typeof saveDb === 'function') saveDb();
                if (typeof updateSRSQueue === 'function') updateSRSQueue();
                window.renderRems();
            }
        });

        row.appendChild(bullet);
        row.appendChild(input);
        row.appendChild(delBtn);
        container.appendChild(row);
    });
};

// ============================================================
// SRS REVIEW — Spaced repetition review session
// ============================================================
let reviewQueue = [];
let currentReviewIdx = 0;
let reviewFlaggedSet = new Set();

// Open / close the USMLE full-screen overlay
window.openFullscreen = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};
window.closeFullscreen = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

window.startReview = function () {
    if (!activeDocId) return;
    const now = Date.now();
    reviewQueue = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === activeDocId);

    if (reviewQueue.length === 0) {
        alert("No flashcards due for review! 🎉");
        return;
    }

    reviewFlaggedSet = new Set();
    currentReviewIdx = 0;
    buildReviewSidebar();
    showReviewCard();
    window.openFullscreen('review-modal');
};

window.startChunkReview = function (topic) {
    if (!activeDocId) return;
    
    reviewQueue = db.rems.filter(r => r.isFlashcard && r.docId === activeDocId && (r.topic === topic || (r.topic && r.topic.includes(topic))));

    if (reviewQueue.length === 0) {
        alert("No flashcards found for this section! Generate them first.");
        return;
    }

    reviewFlaggedSet = new Set();
    currentReviewIdx = 0;
    buildReviewSidebar();
    showReviewCard();
    window.openFullscreen('review-modal');
};

function buildReviewSidebar() {
    const sidebar = document.getElementById('review-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';
    reviewQueue.forEach((card, idx) => {
        const item = document.createElement('div');
        item.className = 'usmle-sidebar-item' + (idx === currentReviewIdx ? ' active' : '');
        item.id = `review-sidebar-item-${idx}`;
        item.textContent = idx + 1;
        item.onclick = () => { currentReviewIdx = idx; buildReviewSidebar(); showReviewCard(); };
        sidebar.appendChild(item);
    });
}

function updateReviewSidebarActive() {
    document.querySelectorAll('.usmle-sidebar-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === currentReviewIdx);
        if (reviewFlaggedSet.has(idx)) el.classList.add('flagged');
        else el.classList.remove('flagged');
    });
    // scroll active into view
    const activeEl = document.getElementById(`review-sidebar-item-${currentReviewIdx}`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

window.reviewNavPrev = function() {
    if (currentReviewIdx > 0) {
        currentReviewIdx--;
        updateReviewSidebarActive();
        showReviewCard();
    }
};

window.reviewNavNext = function() {
    if (currentReviewIdx < reviewQueue.length - 1) {
        currentReviewIdx++;
        updateReviewSidebarActive();
        showReviewCard();
    }
};

window.toggleReviewFlag = function() {
    const btn = document.getElementById('review-flag-btn');
    if (reviewFlaggedSet.has(currentReviewIdx)) {
        reviewFlaggedSet.delete(currentReviewIdx);
        if (btn) btn.classList.remove('flagged');
    } else {
        reviewFlaggedSet.add(currentReviewIdx);
        if (btn) btn.classList.add('flagged');
    }
    updateReviewSidebarActive();
};


function showReviewCard() {
    if (currentReviewIdx >= reviewQueue.length) {
        window.closeFullscreen('review-modal');
        alert("Review session complete! 🎉");
        if (typeof refreshAppUI === 'function') refreshAppUI();
        return;
    }

    const card = reviewQueue[currentReviewIdx];
    const doc = db.documents.find(d => d.id === card.docId);

    // Update top bar info
    const countEl = document.getElementById('review-count');
    if (countEl) countEl.textContent = currentReviewIdx + 1;
    const docTitleEl = document.getElementById('review-doc-title');
    if (docTitleEl) docTitleEl.textContent = doc ? doc.title : 'Document';
    const navCounter = document.getElementById('review-nav-counter');
    if (navCounter) navCounter.textContent = `${currentReviewIdx + 1} / ${reviewQueue.length}`;
    const statusText = document.getElementById('review-status-text');
    if (statusText) statusText.textContent = 'Press Space to reveal answer';

    // Flag state
    const flagBtn = document.getElementById('review-flag-btn');
    if (flagBtn) {
        flagBtn.classList.toggle('flagged', reviewFlaggedSet.has(currentReviewIdx));
    }

    // Set question text
    const frontEl = document.getElementById('card-front');
    if (frontEl) frontEl.textContent = card.front;

    // Reset answer area
    const backEl = document.getElementById('card-back');
    if (backEl) {
        backEl.textContent = card.back;
        backEl.style.display = 'none';
    }

    // Reset buttons
    const showBtn = document.getElementById('btn-show-answer');
    if (showBtn) showBtn.style.display = 'inline-block';
    const srsButtons = document.getElementById('srs-buttons');
    if (srsButtons) srsButtons.style.display = 'none';
    const docExplainBtn = document.getElementById('btn-doc-explain-card');
    if (docExplainBtn) docExplainBtn.style.display = 'none';

    // Show source if available
    const sourcesBlock = document.getElementById('card-sources-block');
    const sourceText = document.getElementById('card-source-text');
    if (card.sourceText && card.sourceText.trim()) {
        if (sourceText) sourceText.textContent = card.sourceText;
        if (sourcesBlock) sourcesBlock.style.display = 'none'; // Hidden until answer shown
    } else {
        if (sourcesBlock) sourcesBlock.style.display = 'none';
    }
    
    // Update sidebar active
    updateReviewSidebarActive();
}

window.showAnswer = function () {
    const card = reviewQueue[currentReviewIdx];
    if (!card) return;

    // Reveal answer in the styled reveal box
    const backEl = document.getElementById('card-back');
    if (backEl) {
        backEl.textContent = card.back;
        backEl.style.display = 'block';
    }

    const showBtn = document.getElementById('btn-show-answer');
    if (showBtn) showBtn.style.display = 'none';
    const srsButtons = document.getElementById('srs-buttons');
    if (srsButtons) srsButtons.style.display = 'flex';
    
    const docExplainBtn = document.getElementById('btn-doc-explain-card');
    if (docExplainBtn) docExplainBtn.style.display = 'inline-flex';

    const statusText = document.getElementById('review-status-text');
    if (statusText) statusText.textContent = '1 = Disable  |  2 = Forgot  |  3 = Remembered';

    // Show sources if available
    if (card.sourceText && card.sourceText.trim()) {
        const sourcesBlock = document.getElementById('card-sources-block');
        if (sourcesBlock) sourcesBlock.style.display = 'block';
    }
};

window.submitReview = function (rating) {
    const card = reviewQueue[currentReviewIdx];
    if (!card) return;

    const now = Date.now();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    switch (rating) {
        case 'disable':
            card.isFlashcard = false;
            card.nextReview = 0;
            break;
        case 'forgot':
            card.ease = Math.max(1.3, card.ease - 0.2);
            card.interval = 0;
            card.nextReview = now + minute;
            break;
        case 'easy':
            if (card.interval === 0) {
                card.interval = 1;
            } else {
                card.interval = Math.round(card.interval * card.ease);
            }
            card.ease = Math.min(3.0, card.ease + 0.1);
            card.nextReview = now + (card.interval * day);
            break;
    }

    if (typeof saveDb === 'function') saveDb();
    if (typeof updateSRSQueue === 'function') updateSRSQueue();

    // Mark as answered in sidebar
    const sidebarItem = document.getElementById(`review-sidebar-item-${currentReviewIdx}`);
    if (sidebarItem) sidebarItem.classList.add('answered');

    currentReviewIdx++;
    if (currentReviewIdx >= reviewQueue.length) {
        window.closeFullscreen('review-modal');
        alert("Review session complete! 🎉");
        if (typeof refreshAppUI === 'function') refreshAppUI();
    } else {
        updateReviewSidebarActive();
        showReviewCard();
    }
};

window.explainCurrentFlashcard = function() {
    const card = reviewQueue[currentReviewIdx];
    if (!card) return;
    
    let textToExplain = card.front + " ➔ " + card.back;
    
    // Check if the user has selected specific text
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
        textToExplain = selection;
    }
    
    if (typeof window.openModal === 'function') {
        window.openFullscreen('doc-explain-modal');
    } else {
        const m = document.getElementById('doc-explain-modal');
        if (m) m.style.display = 'flex';
    }

    const contentDiv = document.getElementById('doc-explain-modal-content');
    contentDiv.innerHTML = '<div style="color:var(--accent-active); text-align: center; margin-top: 20px;">جاري التحليل كطبيب استشاري...</div>';

    const messages = [
        { role: "system", content: "You are a friendly senior Egyptian doctor explaining medical concepts to a medical student. Your ONLY task is to explain the specific sentence provided by the user. Do NOT explain unrelated topics. Explain the provided sentence in simple Egyptian Arabic. CRITICAL RULE: All medical terms, anatomical names, diseases, definitions, and informational keywords MUST be kept strictly in English and MUST NOT be translated to Arabic under any circumstances (e.g. write 'central incisors' instead of 'القواطع المركزية'). To make studying easier, structure your response with these sections: 1) <strong>المعنى ببساطة:</strong> A simple explanation. 2) <strong>تشبيه من الحياة:</strong> A clever real-life analogy (تشبيه بلدي). 3) <strong>عشان تفتكرها (بصمجة):</strong> A funny or clever memory trick/mnemonic to memorize it for exams. Format your explanation beautifully using simple HTML tags like <ul>, <li>, and <strong>. Do NOT use any inline CSS colors or backgrounds. Ensure text layout and alignment are proper for RTL formatting mixed with LTR English words. Return ONLY the HTML without any markdown formatting." },
        { role: "user", content: `Concept to explain: "${textToExplain}"` }
    ];

    if (typeof callGroqAPI !== 'undefined') {
        callGroqAPI(messages, false).then(reply => {
            if (reply && !reply._error) {
                let cleanReply = reply.replace(/```html/gi, '').replace(/```/g, '').trim();
                contentDiv.innerHTML = cleanReply;
            } else {
                contentDiv.innerHTML = '<div style="color:red; text-align: center;">حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.</div>';
            }
        });
    }
};

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    // renderRems will be called by refreshAppUI in app.js
    
    // Flashcard keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const reviewModal = document.getElementById('review-modal');
        if (reviewModal && reviewModal.style.display !== 'none') {
            const btnShowAnswer = document.getElementById('btn-show-answer');
            const srsButtons = document.getElementById('srs-buttons');
            
            if (btnShowAnswer && btnShowAnswer.style.display !== 'none') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    window.showAnswer();
                }
            } else if (srsButtons && srsButtons.style.display !== 'none') {
                if (e.key === '1') {
                    e.preventDefault();
                    window.submitReview('disable');
                } else if (e.key === '2') {
                    e.preventDefault();
                    window.submitReview('forgot');
                } else if (e.key === '3') {
                    e.preventDefault();
                    window.submitReview('easy');
                }
            }
            
            // Arrow key navigation
            if (e.key === 'ArrowLeft') { e.preventDefault(); window.reviewNavPrev(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); window.reviewNavNext(); }
        }
        
        // Escape closes any open fullscreen
        if (e.key === 'Escape') {
            const reviewModal = document.getElementById('review-modal');
            const examModal = document.getElementById('exam-modal');
            if (reviewModal && reviewModal.style.display !== 'none') window.closeFullscreen('review-modal');
            if (examModal && examModal.style.display !== 'none') window.closeFullscreen('exam-modal');
        }
    });
});