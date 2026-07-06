// Custom Text Selection Popover Logic

let currentSelection = "";
let popoverActive = false;

window.addEventListener('mouseup', handleTextSelection);
window.addEventListener('mousedown', hidePopoverIfClickOutside);

function handleTextSelection(e) {
    const popover = document.getElementById('selection-popover');

    // Ignore clicks inside the popover itself
    if (popover.contains(e.target)) return;

    // Get selection
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 5 && isSelectionInsideSummary(selection)) {
        currentSelection = text;
        showPopover(e, selection);
    } else {
        hidePopover();
    }
}

function isSelectionInsideSummary(selection) {
    let node = selection.anchorNode;
    while (node && node.nodeName !== 'BODY') {
        if (node.id === 'summary-content' || (node.classList && node.classList.contains('review-modal-content'))) return true;
        node = node.parentNode;
    }
    return false;
}

function showPopover(e, selection) {
    const popover = document.getElementById('selection-popover');

    // Calculate position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position slightly below and centered on the selection
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX + (rect.width / 2) - 225; // 450px width / 2

    // Ensure it doesn't go off screen
    if (left < 10) left = 10;

    popover.style.top = top + 'px';
    popover.style.left = left + 'px';

    // Reset state
    document.querySelectorAll('.popover-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.popover-btn')[0].classList.add('active'); // Explain active
    document.getElementById('popover-content').innerHTML = '<div style="color:var(--text-muted)">Click "Explain" to get an AI breakdown.</div>';

    popover.classList.add('active');
    popoverActive = true;
}

function hidePopover() {
    const popover = document.getElementById('selection-popover');
    popover.classList.remove('active');
    popoverActive = false;
    currentSelection = "";
}

function hidePopoverIfClickOutside(e) {
    if (!popoverActive) return;
    const popover = document.getElementById('selection-popover');
    if (!popover.contains(e.target)) {
        // We defer hide so mouseup has a chance to catch a new selection
        setTimeout(() => {
            const sel = window.getSelection().toString().trim();
            if (!sel) hidePopover();
        }, 10);
    }
}

// AI Integration for Popover
window.explainText = async function () {
    if (!currentSelection) return;

    document.querySelectorAll('.popover-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.popover-btn')[0].classList.add('active');

    const contentDiv = document.getElementById('popover-content');
    contentDiv.innerHTML = '<div style="color:var(--accent-active)">Analyzing sentence...</div>';

    const messages = [
        { role: "system", content: "You are an expert tutor. Explain the following sentence in simple terms. Use bullet points formatting. Example: \n<ul><li><strong>Term 1</strong>: Explanation</li><li><strong>Term 2</strong>: Explanation</li></ul>. Return ONLY the HTML." },
        { role: "user", content: `Sentence: "${currentSelection}"` }
    ];

    if (typeof callFastGroqAPI !== 'undefined') {
        const reply = await callFastGroqAPI(messages, false);
        if (reply) {
            contentDiv.innerHTML = reply;
        } else {
            contentDiv.innerHTML = '<div style="color:red">Failed to explain text.</div>';
        }
    }
}

window.docExplainText = async function () {
    if (!currentSelection) return;
    
    const textToExplain = currentSelection; // Save it before hidePopover clears it

    hidePopover(); // Hide the selection menu

    if (typeof window.openModal === 'function') {
        window.openFullscreen('doc-explain-modal');
    } else {
        const m = document.getElementById('doc-explain-modal');
        if (m) m.style.display = 'flex';
    }

    const modalContainer = document.getElementById('doc-explain-modal-container');
    if (modalContainer) modalContainer.style.maxWidth = '600px';

    const contentDiv = document.getElementById('doc-explain-modal-content');
    contentDiv.innerHTML = '<div style="color:var(--accent-active); text-align: center; margin-top: 20px;">جاري التحليل كطبيب استشاري...</div>';

    const messages = [
        { role: "system", content: "You are a friendly senior Egyptian doctor explaining medical concepts to a medical student. Your ONLY task is to explain the specific sentence provided by the user. Do NOT explain unrelated topics. Explain the provided sentence in simple Egyptian Arabic. CRITICAL RULE: All medical terms, anatomical names, diseases, definitions, and informational keywords MUST be kept strictly in English and MUST NOT be translated to Arabic under any circumstances (e.g. write 'central incisors' instead of 'القواطع المركزية'). To make studying easier, structure your response with these sections: 1) <strong>المعنى ببساطة:</strong> A simple explanation. 2) <strong>تشبيه من الحياة:</strong> A clever real-life analogy (تشبيه بلدي). 3) <strong>عشان تفتكرها (بصمجة):</strong> A funny or clever memory trick/mnemonic to memorize it for exams. Format your explanation beautifully using simple HTML tags like <ul>, <li>, and <strong>. Do NOT use any inline CSS colors or backgrounds. Ensure text layout and alignment are proper for RTL formatting mixed with LTR English words. Return ONLY the HTML without any markdown formatting." },
        { role: "user", content: `Sentence to explain: "${textToExplain}"` }
    ];

    if (typeof callGroqAPI !== 'undefined') {
        const reply = await callGroqAPI(messages, false);
        if (reply && !reply._error) {
            // Remove markdown code blocks if any
            let cleanReply = reply.replace(/```html/gi, '').replace(/```/g, '').trim();
            contentDiv.innerHTML = cleanReply;
        } else {
            contentDiv.innerHTML = '<div style="color:red; text-align: center;">حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.</div>';
        }
    }
}

window.addCardFromSelection = async function () {
    if (!currentSelection) return;

    document.querySelectorAll('.popover-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.popover-btn')[2].classList.add('active'); // Index 2 is Add Card

    const contentDiv = document.getElementById('popover-content');
    contentDiv.innerHTML = '<div style="color:var(--accent-active)">Generating flashcard...</div>';

    const messages = [
        { role: "system", content: "Create a single flashcard from this sentence tailored for medical students. Follow medical flashcard rules (Minimum Information Principle, Mnemonic Hints). Choose the MOST APPROPRIATE format from: Basic, Cloze with {{c1::Answer}}, Image Occlusion, Comparison, Mechanism/Pathway. Return JSON: {\"front\": \"Question\", \"back\": \"Answer\"}" },
        { role: "user", content: `Sentence: "${currentSelection}"` }
    ];

    if (typeof callFastGroqAPI !== 'undefined') {
        const reply = await callFastGroqAPI(messages, true);
        if (reply) {
            try {
                // simple json extraction if possible
                let clean = reply.replace(/```json/gi, '').replace(/```/g, '').trim();
                const data = JSON.parse(clean);
                if (data.front && data.back && window.addRem) {
                    window.addRem(activeDocId, `${data.front} == ${data.back}`, 0, null, currentSelection);
                    if (window.saveDb) window.saveDb();
                    if (window.renderRems) window.renderRems();

                    contentDiv.innerHTML = `<div style="color:#22c55e; font-weight:bold;">✅ Flashcard added!</div>
                                            <div style="margin-top:10px; color:var(--text-muted)">Q: ${data.front}<br>A: ${data.back}</div>`;
                }
            } catch (e) {
                contentDiv.innerHTML = '<div style="color:red">Failed to generate flashcard.</div>';
            }
        }
    }
}

window.copyExplanation = function () {
    const text = document.getElementById('popover-content').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-copy');
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = orig, 2000);
    });
}

window.showImageForSelection = function () {
    if (!currentSelection) return;

    const term = currentSelection.trim();
    hidePopover();

    // Open Google Images in a small popup window over the app
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`;
    const windowFeatures = "width=1000,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
    window.open(url, 'ImageSearch', windowFeatures);
}
// Tablet Toolbar Integrations
window.tabletExplain = function() {
    const text = window.getSelection().toString().trim();
    if (!text || text.length < 5) return alert('Please select some text first.');
    currentSelection = text;
    
    const popover = document.getElementById('selection-popover');
    popover.style.transform = 'none';
    popover.style.top = (window.innerHeight / 2 - 100) + 'px';
    popover.style.left = (window.innerWidth / 2 - 225) + 'px';
    popover.classList.add('active');
    popoverActive = true;
    
    window.explainText();
};

window.tabletDocExplain = function() {
    const text = window.getSelection().toString().trim();
    if (!text || text.length < 5) return alert('Please select some text first.');
    currentSelection = text;
    
    // We don't need to show the popover since docExplainText handles its own modal now
    window.docExplainText();
};

window.highlightSelection = function() {
    if (!currentSelection) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('mark');
    span.style.backgroundColor = 'rgba(245, 158, 11, 0.4)';
    span.style.color = 'inherit';
    span.style.borderRadius = '2px';
    try {
        range.surroundContents(span);
        if (window.saveEditedSummary) window.saveEditedSummary();
    } catch(e) {
        alert("Please select text within a single paragraph to highlight.");
    }
    hidePopover();
};

window.addNoteToSelection = function() {
    if (!currentSelection) return;
    const note = prompt("Enter your note:");
    if (!note) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.borderBottom = '2px dashed var(--accent-cyan)';
    span.style.cursor = 'help';
    span.title = note;
    try {
        range.surroundContents(span);
        if (window.saveEditedSummary) window.saveEditedSummary();
    } catch(e) {
        alert("Please select text within a single paragraph to add a note.");
    }
    hidePopover();
};

window.saveEditedSummary = function() {
    const contentDiv = document.getElementById('summary-content');
    if (!contentDiv || !window.currentSummaryTopic) return;
    
    const clone = contentDiv.cloneNode(true);
    const quizzes = clone.querySelectorAll('.section-quiz-wrap');
    quizzes.forEach(q => q.remove());
    
    const doc = window.getActiveDoc ? window.getActiveDoc() : null;
    if (doc && doc.sections) {
        const sec = doc.sections.find(s => s.title === window.currentSummaryTopic);
        if (sec) {
            sec.summaryCacheHTML = clone.innerHTML;
            if (typeof saveDb === 'function') saveDb();
        }
    }
};

window.editSelectionText = function() {
    if (!currentSelection) return;
    const newText = prompt("Edit text:", currentSelection);
    if (newText !== null) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        if (window.saveEditedSummary) window.saveEditedSummary();
    }
    hidePopover();
};

window.tabletFlashcard = function() {
    const text = window.getSelection().toString().trim();
    if (!text || text.length < 5) return alert('Please select some text first.');
    currentSelection = text;
    
    const popover = document.getElementById('selection-popover');
    popover.style.transform = 'none';
    popover.style.top = (window.innerHeight / 2 - 100) + 'px';
    popover.style.left = (window.innerWidth / 2 - 225) + 'px';
    popover.classList.add('active');
    popoverActive = true;
    
    window.addCardFromSelection();
};



window.explainCurrentSummary = async function () {
    if (!window.currentSummaryTopic) return;
    const doc = window.getActiveDoc ? window.getActiveDoc() : null;
    if (!doc || !doc.sections) return;
    const sec = doc.sections.find(s => s.title === window.currentSummaryTopic);
    if (!sec || !sec.summaryCache) return;

    const textToExplain = sec.summaryCache; // The entire summary

    if (typeof window.openModal === 'function') {
        window.openFullscreen('doc-explain-modal');
    } else {
        const m = document.getElementById('doc-explain-modal');
        if (m) m.style.display = 'flex';
    }

    const modalContainer = document.getElementById('doc-explain-modal-container');
    if (modalContainer) modalContainer.style.maxWidth = '1200px';

    const contentDiv = document.getElementById('doc-explain-modal-content');
    contentDiv.innerHTML = '<div style="color:var(--accent-active); text-align: center; margin-top: 20px;">جاري تحليل الملخص بالكامل كطبيب استشاري... (قد يستغرق بعض الوقت)</div>';

    const messages = [
        { role: "system", content: "You are a friendly senior Egyptian doctor explaining a full topic summary to a medical student. Your task is to exhaustively and comprehensively explain EVERY SINGLE FACT, concept, sub-point, and example present in the provided text. You MUST NOT miss a single point. Do NOT summarize or be brief; you must break down the entire text exhaustively so the student fully understands the whole topic before reading it. Explain in simple Egyptian Arabic. CRITICAL RULE: All medical terms, anatomical names, diseases, definitions, and informational keywords MUST be kept strictly in English and MUST NOT be translated to Arabic under any circumstances (e.g. write 'central incisors' instead of 'القواطع المركزية'). Structure your response with these sections: 1) <strong>نظرة عامة (المعنى ببساطة):</strong> A simple introduction to the topic. 2) <strong>شرح تفصيلي لكل نقطة:</strong> Go through the provided text paragraph by paragraph, point by point. Extract EVERY SINGLE concept and example mentioned in the text and explain it thoroughly. Do not skip any details. 3) <strong>تشبيه من الحياة:</strong> Clever real-life analogies (تشبيه بلدي) for the main concepts. 4) <strong>عشان تفتكرها (بصمجة):</strong> Funny or clever memory tricks/mnemonics to memorize the key points for exams. Format your explanation beautifully using simple HTML tags like <ul>, <li>, and <strong>. Do NOT use any inline CSS colors or backgrounds. Ensure text layout and alignment are proper for RTL formatting mixed with LTR English words. Return ONLY the HTML without any markdown formatting." },
        { role: "user", content: `Text to explain: "${textToExplain}"` }
    ];

    if (typeof callGroqAPI !== 'undefined') {
        const reply = await callGroqAPI(messages, false);
        if (reply && !reply._error) {
            // Remove markdown code blocks if any
            let cleanReply = reply.replace(/```html/gi, '').replace(/```/g, '').trim();
            contentDiv.innerHTML = cleanReply;
        } else {
            contentDiv.innerHTML = '<div style="color:red; text-align: center;">حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.</div>';
        }
    }
}
