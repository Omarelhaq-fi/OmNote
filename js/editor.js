// Editor & SRS Logic

function getRemsForDoc(docId) {
    return db.rems.filter(r => r.docId === docId).sort((a, b) => a.order - b.order);
}

window.addRem = function(docId, content, level, afterOrder = null, source = "") {
    const order = afterOrder !== null ? afterOrder + 0.5 : db.rems.length; 
    const rem = {
        id: generateId(),
        docId,
        content,
        level,
        order,
        isFlashcard: false,
        cardFront: '',
        cardBack: '',
        cardSource: source,
        nextReview: 0,
        interval: 0,
        ease: 2.5
    };
    parseFlashcard(rem);
    db.rems.push(rem);
    // Normalize orders
    const docRems = getRemsForDoc(docId);
    docRems.forEach((r, idx) => r.order = idx);
    return rem;
}

function parseFlashcard(rem) {
    const separatorIdx = rem.content.indexOf('==');
    if (separatorIdx !== -1) {
        rem.isFlashcard = true;
        rem.cardFront = rem.content.substring(0, separatorIdx).trim();
        rem.cardBack = rem.content.substring(separatorIdx + 2).trim();
        if (rem.nextReview === 0) rem.nextReview = Date.now();
    } else {
        rem.isFlashcard = false;
    }
}

window.renderRems = function() {
    const container = document.getElementById('editor-container');
    if(!container) return;
    container.innerHTML = '';
    if (!activeDocId) return;
    
    const docRems = getRemsForDoc(activeDocId);
    
    docRems.forEach((rem, index) => {
        const remDiv = document.createElement('div');
        remDiv.className = 'rem';
        remDiv.style.marginLeft = `${rem.level * 30}px`;
        
        const bullet = document.createElement('div');
        bullet.className = 'rem-bullet';
        
        const content = document.createElement('div');
        content.className = 'rem-content';
        content.contentEditable = true;
        content.setAttribute('placeholder', 'Type a rem...');
        
        if (rem.isFlashcard) {
            content.innerHTML = rem.cardFront + ' <span class="flashcard-cloze">==</span> ' + rem.cardBack;
        } else {
            content.innerText = rem.content;
        }

        content.onkeydown = (e) => handleRemKeyDown(e, rem, index, content);
        content.onblur = (e) => {
            const newContent = content.innerText.replace(/\n/g, ''); 
            if (rem.content !== newContent) {
                rem.content = newContent;
                parseFlashcard(rem);
                saveDb();
                if (rem.content.includes('==')) window.renderRems(); 
            }
        };

        remDiv.appendChild(bullet);
        remDiv.appendChild(content);
        container.appendChild(remDiv);
    });
}

function handleRemKeyDown(e, rem, index, contentDiv) {
    const docRems = getRemsForDoc(activeDocId);
    
    if (e.key === 'Enter') {
        e.preventDefault();
        rem.content = contentDiv.innerText;
        parseFlashcard(rem);
        window.addRem(activeDocId, "", rem.level, rem.order);
        saveDb();
        window.renderRems();
        focusRem(index + 1);
    } 
    else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            if (rem.level > 0) {
                rem.level--;
                saveDb();
                window.renderRems();
                focusRem(index);
            }
        } else {
            if (index > 0 && rem.level <= docRems[index-1].level) {
                rem.level++;
                saveDb();
                window.renderRems();
                focusRem(index);
            }
        }
    }
    else if (e.key === 'Backspace' && contentDiv.innerText === '') {
        e.preventDefault();
        if (docRems.length > 1) {
            db.rems = db.rems.filter(r => r.id !== rem.id);
            saveDb();
            window.renderRems();
            focusRem(index > 0 ? index - 1 : 0);
        }
    }
    else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (index > 0) focusRem(index - 1);
    }
    else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (index < docRems.length - 1) focusRem(index + 1);
    }
}

function focusRem(index) {
    setTimeout(() => {
        const contents = document.querySelectorAll('.rem-content');
        if (contents[index]) {
            contents[index].focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(contents[index]);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, 10);
}

// --- SRS REVIEW MODAL ---
let currentReviewCard = null;

window.startReview = function() {
    updateSRSQueue();
    const now = Date.now();
    const reviewQueue = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === activeDocId);
    
    if (reviewQueue.length === 0) {
        alert("You are all caught up for this document!");
        return;
    }
    
    openModal('review-modal');
    currentReviewCard = reviewQueue[0];
    document.getElementById('review-count').innerText = reviewQueue.length;
    const doc = db.documents.find(d => d.id === currentReviewCard.docId);
    if (document.getElementById('review-doc-title')) {
        document.getElementById('review-doc-title').innerText = doc ? doc.title : "Document";
    }

    document.getElementById('card-front').innerText = currentReviewCard.cardFront;
    document.getElementById('card-back').innerText = " ➔ " + currentReviewCard.cardBack;
    document.getElementById('card-back').style.display = 'none';
    
    document.getElementById('btn-show-answer').style.display = 'block';
    document.getElementById('srs-buttons').style.display = 'none';
    if(document.getElementById('card-sources-block')) {
        document.getElementById('card-sources-block').style.display = 'none';
    }
}

window.showAnswer = function() {
    document.getElementById('card-back').style.display = 'inline';
    document.getElementById('btn-show-answer').style.display = 'none';
    document.getElementById('srs-buttons').style.display = 'flex';
    
    if (currentReviewCard.cardSource && document.getElementById('card-sources-block')) {
        document.getElementById('card-sources-block').style.display = 'block';
        document.getElementById('card-source-text').innerText = currentReviewCard.cardSource;
    }
}

window.submitReview = function(rating) {
    const c = currentReviewCard;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    if (rating === 'disable') {
        db.rems = db.rems.filter(r => r.id !== c.id);
        saveDb();
        if(window.renderRems) window.renderRems();
    } else if (rating === 'forgot') {
        c.interval = 0;
        c.ease = Math.max(1.3, c.ease - 0.2);
        c.nextReview = now + 10 * 60 * 1000; 
        saveDb();
    } else {
        c.interval = Math.max(4, c.interval === 0 ? 4 : c.interval * c.ease * 1.3);
        c.ease += 0.15;
        c.nextReview = now + (c.interval * dayMs);
        saveDb();
    }
    
    // Check if more to review
    const reviewQueue = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === activeDocId);
    if(reviewQueue.length > 0) {
        window.startReview();
    } else {
        closeModal('review-modal');
        updateSRSQueue();
    }
    
    if (window.refreshAppUI) {
        window.refreshAppUI();
    }
}
