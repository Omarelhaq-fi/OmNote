// Smart Study Session Logic

let activeSession = null;
let sessionTimerInterval = null;

// Opens the modal to select documents for the smart session
window.openSmartSessionModal = function() {
    const listContainer = document.getElementById('smart-session-doc-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    // Only show documents that have a study plan generated
    const eligibleDocs = db.documents.filter(d => d.sections && d.sections.length > 0);
    
    if (eligibleDocs.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center;">You need to upload and process at least one PDF into a study plan first.</div>';
    } else {
        eligibleDocs.forEach(doc => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '10px';
            div.style.padding = '10px';
            div.style.background = 'rgba(255,255,255,0.02)';
            div.style.border = '1px solid var(--border-medium)';
            div.style.borderRadius = '6px';
            
            div.innerHTML = `
                <input type="checkbox" id="smart-doc-${doc.id}" class="smart-doc-checkbox" value="${doc.id}" style="width:18px; height:18px; accent-color: var(--accent-cyan);">
                <label for="smart-doc-${doc.id}" style="cursor:pointer; flex:1; font-weight:500;">📄 ${doc.title}</label>
                <div style="font-size:0.8rem; color:var(--text-muted);">${doc.sections.length} sections</div>
            `;
            listContainer.appendChild(div);
        });
    }
    
    window.openModal('smart-session-modal');
}

window.startSmartSessionGeneration = async function() {
    const checkboxes = document.querySelectorAll('.smart-doc-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Please select at least one document.");
        return;
    }
    
    const docIds = Array.from(checkboxes).map(cb => cb.value);
    window.closeModal('smart-session-modal');
    window.showLoadingScreen("Brewing Magic Study Timeline...");
    
    try {
        let allSectionsContext = "";
        let dueCardsCount = 0;
        const targetDocs = db.documents.filter(d => docIds.includes(d.id));
        
        const now = Date.now();
        targetDocs.forEach(doc => {
            // Count due flashcards globally for these docs
            if (db.rems) {
                const due = db.rems.filter(r => r.isFlashcard && r.nextReview <= now && r.docId === doc.id);
                dueCardsCount += due.length;
            }

            doc.sections.forEach(sec => {
                if (sec.summaryRead && sec.flashcardsGenerated && sec.examTaken) {
                    return; // Skip 100% completed sections
                }
                
                // Determine completion status
                let remaining = [];
                if (!sec.summaryRead) remaining.push("summary");
                if (!sec.flashcardsGenerated) remaining.push("flashcard");
                if (!sec.examTaken) remaining.push("quiz");
                
                const charCount = sec.chunkText ? sec.chunkText.length : 0;
                const snippet = sec.chunkText ? sec.chunkText.substring(0, 1000) : "No content";
                
                let fcCount = 0;
                if (typeof db !== 'undefined' && db.rems) {
                    fcCount = db.rems.filter(r => r.isFlashcard && r.docId === doc.id && (r.topic === sec.title || (r.topic && r.topic.includes(sec.title)))).length;
                }
                
                allSectionsContext += `
Document: ${doc.title}
Section Title: ${sec.title}
Text Snippet for Difficulty Estimation: "${snippet.replace(/\n/g, ' ')}..."
Total Character Length: ${charCount}
Actual Flashcards Generated: ${fcCount > 0 ? fcCount : 'Not generated yet'}
REMAINING TASKS YOU MUST GENERATE FOR THIS SECTION: ${remaining.join(', ')}
`;
            });
        });
        
        if (allSectionsContext.trim() === "") {
            if (dueCardsCount === 0) {
                window.hideLoadingScreen();
                alert("You have already 100% completed this document and have no due flashcards! Good job!");
                return;
            }
        }
        
        const messages = [
            { 
                role: "system", 
                content: `You are a world-class AI medical tutor and study strategist. Your job is to create a highly optimized, active micro-task study timeline.

You are provided with actual text snippets, total character lengths, exact flashcard counts, and progress status for document sections.
You MUST:
1) Actively READ the provided text snippet to judge its scientific density and medical difficulty.
2) Calculate precise time allocations. Assume this is the user's FIRST TIME studying this material. They are deeply memorizing and note-taking, not just speed reading.
   - Reading/Studying: Determine the word count. Then, assign a custom Words-Per-Minute (WPM) speed. Use 40-50 WPM for simple text, 20-30 WPM for standard medical concepts, and 10-15 WPM for extremely complex pathways. Calculate the time based on your chosen WPM.
   - Flashcards: Assume 45-60 seconds to actively recall a complex medical flashcard.
3) You MUST generate EXACTLY ONE 'summary' task, EXACTLY ONE 'flashcard' task, and EXACTLY ONE 'quiz' task per section. DO NOT generate multiple summary tasks for the same section.
4) Ensure the flow is logical: Summary (Learn) -> Break -> Flashcard (Recall) -> Break -> Quiz (Test).
5) Insert very short micro-breaks (e.g., 2-3 minutes) between chunks to maximize active recall and prevent cognitive fatigue.

Return an ordered timeline perfectly sequenced for mastery.
You MUST return ONLY valid JSON in this format. DO NOT copy the example numbers, you MUST calculate them dynamically based on your reasoning using the medical difficulty and WPM:
{
  "total_estimated_mins": 165,
  "timeline": [
    {
      "type": "summary",
      "docId": "<docId from prompt context>",
      "topic": "Section Title",
      "description": "Deep study and active note-taking (first time)",
      "reasoning": "The text contains approx 1500 words. Because it is highly complex pharmacology, I am assigning a deep-study speed of 15 WPM. 1500 / 15 = 100 minutes.",
      "duration_mins": 100
    },
    {
      "type": "break",
      "topic": "Micro-Break",
      "description": "Close eyes and breathe",
      "reasoning": "Brain needs rest after dense reading",
      "duration_mins": 5
    },
    {
      "type": "flashcard",
      "topic": "Section Title",
      "description": "Active recall on facts",
      "reasoning": "Based on the content length, I predict ~60 flashcards. At 45 secs each, that's 45 mins.",
      "duration_mins": 45
    },
    {
      "type": "quiz",
      "topic": "Section Title",
      "description": "Self-assessment",
      "reasoning": "Predicting ~10 questions. At 90 secs each, that's 15 mins.",
      "duration_mins": 15
    }
  ]
}

Only use valid types: "summary", "flashcard", "quiz", "break".
Ensure the plan flows perfectly. Return ONLY the JSON.`
            },
            { 
                role: "user", 
                content: `Here are the document sections I want to study today:\n${allSectionsContext}\n\nPlease generate my magic study timeline.` 
            }
        ];
        
        const reply = await window.callGroqAPI ? await window.callGroqAPI(messages, true) : null;
        
        if (reply && !reply._error) {
            let data = { timeline: [], total_estimated_mins: 0 };
            if (allSectionsContext.trim() !== "") {
                data = typeof parseAIJson === 'function' ? parseAIJson(reply) : JSON.parse(reply);
            }
            
            if (data && data.timeline) {
                // PREPEND SRS Review Task if due cards exist
                if (dueCardsCount > 0) {
                    const calculatedReviewTimeMins = Math.max(1, Math.ceil((dueCardsCount * 15) / 60)); // 15s per card
                    data.timeline.unshift({
                        "type": "review",
                        "docId": docIds[0],
                        "topic": "Due Flashcards",
                        "description": `Review ${dueCardsCount} due flashcards before starting new material.`,
                        "reasoning": "Spaced repetition priority.",
                        "duration_mins": calculatedReviewTimeMins
                    });
                    data.total_estimated_mins += calculatedReviewTimeMins;
                }
            
                // Initialize the active session
                activeSession = {
                    totalTimeMins: data.total_estimated_mins,
                    timeline: data.timeline,
                    currentIndex: 0,
                    taskTimeLeftSecs: data.timeline[0].duration_mins * 60,
                    targetDocs: targetDocs
                };
                
                window.hideLoadingScreen();
                openActiveSessionUI();
            } else {
                throw new Error("Failed to parse timeline from AI.");
            }
        } else {
            throw new Error(reply ? reply._error : "AI returned an error.");
        }
        
    } catch (e) {
        console.error(e);
        window.hideLoadingScreen();
        alert("Error generating smart session: " + e.message);
    }
}

function openActiveSessionUI() {
    const overlay = document.getElementById('active-session-overlay');
    if (!overlay) return;
    
    overlay.style.display = 'block';
    renderActiveSession();
    
    // Start interval
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(sessionTick, 1000);
}

window.closeActiveSessionUI = function() {
    const overlay = document.getElementById('active-session-overlay');
    if (overlay) overlay.style.display = 'none';
    
    if (sessionTimerInterval) {
        clearInterval(sessionTimerInterval);
        sessionTimerInterval = null;
    }
    activeSession = null;
}

function renderActiveSession() {
    if (!activeSession) return;
    
    const taskTitle = document.getElementById('session-task-title');
    const taskDesc = document.getElementById('session-task-desc');
    const timeEl = document.getElementById('session-time-left');
    const listEl = document.getElementById('session-upcoming-list');
    
    const currentTask = activeSession.timeline[activeSession.currentIndex];
    
    if (!currentTask) {
        // Session Complete
        taskTitle.innerText = "🎉 Session Complete!";
        taskDesc.innerText = "You crushed it. Take a well-deserved break.";
        timeEl.innerText = "00:00";
        listEl.innerHTML = '';
        if (sessionTimerInterval) clearInterval(sessionTimerInterval);
        return;
    }
    
    // Set icon
    let icon = '📝';
    if (currentTask.type === 'summary') icon = '📑';
    if (currentTask.type === 'flashcard') icon = '🃏';
    if (currentTask.type === 'quiz') icon = '❓';
    if (currentTask.type === 'break') icon = '☕';
    
    taskTitle.innerText = `${icon} ${currentTask.topic}`;
    taskDesc.innerText = currentTask.description;
    
    const mins = Math.floor(activeSession.taskTimeLeftSecs / 60);
    const secs = activeSession.taskTimeLeftSecs % 60;
    timeEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Update upcoming list
    listEl.innerHTML = '';
    for (let i = activeSession.currentIndex + 1; i < activeSession.timeline.length && i < activeSession.currentIndex + 4; i++) {
        const t = activeSession.timeline[i];
        let tIcon = '📝';
        if (t.type === 'summary') tIcon = '📑';
        if (t.type === 'flashcard') tIcon = '🃏';
        if (t.type === 'quiz') tIcon = '❓';
        if (t.type === 'break') tIcon = '☕';
        
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.padding = '8px 12px';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.borderRadius = '6px';
        div.style.fontSize = '0.9rem';
        div.style.color = 'var(--text-secondary)';
        
        div.innerHTML = `
            <span>${tIcon} ${t.topic}</span>
            <span>${t.duration_mins}m</span>
        `;
        listEl.appendChild(div);
    }
    
    // Only auto navigate if we just switched to this task (time is full)
    // Wait, we can just call it always. If the task is paused, autoNavigate handles the generation.
    // However, to prevent infinite loops, we should only call it when first rendering the task.
    // The safest way is to let autoNavigateToTask handle itself, but we will call it from here.
    if (!currentTask._navigated) {
        currentTask._navigated = true;
        autoNavigateToTask(currentTask);
    }
}

window.resetDocumentProgress = function() {
    if (!activeDocId) {
        alert("No active document selected.");
        return;
    }
    
    if (!confirm("Are you sure you want to fully reset this document? This will DELETE all flashcards, empty all quizzes, clear the Magic Session timeline, and reset your progress. This CANNOT be undone.")) {
        return;
    }
    
    const doc = getActiveDoc();
    if (!doc) return;
    
    // 1. Delete all flashcards for this doc
    if (db.rems) {
        db.rems = db.rems.filter(r => r.docId !== activeDocId);
    }
    
    // 2. Clear section progress flags
    if (doc.sections) {
        doc.sections.forEach(sec => {
            sec.flashcardsGenerated = false;
            sec.examTaken = false;
            sec.examCache = null;
            sec.summaryRead = false;
            // Note: keeping sec.summaryCache so they don't have to re-pay for the summary unless they want to
        });
    }
    
    // 3. Clear magic session if it's currently running for this doc
    if (activeSession && activeSession.docId === activeDocId) {
        window.closeActiveSessionUI();
        activeSession = null;
        if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    }
    
    // 4. Save and re-render
    if (typeof saveDb === 'function') saveDb();
    if (typeof renderRems === 'function') renderRems();
    if (typeof renderAccordionSections === 'function') renderAccordionSections();
    if (typeof updateSRSQueue === 'function') updateSRSQueue();
    
    alert("Document completely reset. Start fresh!");
}

async function calculateTimeWithAI(type, content) {
    window.showLoadingScreen(`AI is evaluating ${type} difficulty...`);
    let prompt = "";
    
    if (type === 'flashcard') {
        prompt = `You are an expert medical AI evaluator. I am providing you with a list of EXACT flashcards (Front and Back). Read them carefully.
DO NOT GUESS. You must physically count the number of flashcards provided.
Use this baseline: 45 seconds per flashcard for simple recall, 60-90 seconds for complex pathways or tables.
You MUST output your step-by-step mathematical reasoning BEFORE the final number. DO NOT just copy the example.
Return ONLY valid JSON in this exact format: 
{ 
  "reasoning": "I counted 27 flashcards. 15 are complex (15 * 60s = 900s). 12 are simple (12 * 45s = 540s). Total is 1440s.",
  "calculated_seconds": 1440 
}`;
    } else if (type === 'summary') {
        prompt = `You are an expert medical AI evaluator. I am providing you with an actual generated medical summary. Read it carefully to judge its true medical difficulty.
DO NOT GUESS. You must estimate the word count of the text.
IMPORTANT: Assume this is the user's FIRST TIME seeing this complex material. They are not just speed-reading; they are deeply studying, memorizing, and taking notes.
You MUST explicitly assign a custom study speed (Words-Per-Minute) based on the medical difficulty:
- 40-50 WPM for simple text, introductions, or high-level overviews.
- 20-30 WPM for standard medical definitions and concepts.
- 10-15 WPM for extremely dense, complex pharmacology pathways or pathology mechanics (deep memorization).
You MUST output your step-by-step mathematical reasoning BEFORE the final number. DO NOT just copy the example.
Return ONLY valid JSON in this exact format: 
{ 
  "reasoning": "The text is approx 2000 words. It is complex pharmacology (first time studying). I am assigning a deep-study speed of 15 WPM. 2000 / 15 = 133 minutes. 133 * 60 = 7980 seconds.",
  "calculated_seconds": 7980 
}`;
    } else if (type === 'quiz') {
        prompt = `You are an expert medical AI evaluator. I am providing you with actual multiple-choice quiz questions. Read them carefully.
DO NOT GUESS. You must physically count the number of questions.
Use this baseline: 90 seconds for simple recall questions, 150-180 seconds for complex clinical vignettes.
You MUST output your step-by-step mathematical reasoning BEFORE the final number. DO NOT just copy the example.
Return ONLY valid JSON in this exact format: 
{ 
  "reasoning": "There are 10 questions. 5 are complex vignettes (5 * 150s = 750s). 5 are simple (5 * 90s = 450s). Total is 1200s.",
  "calculated_seconds": 1200 
}`;
    }

    const messages = [
        { role: "system", content: prompt },
        { role: "user", content: `Here is the actual content:\n\n${content}` }
    ];

    try {
        const reply = await window.callGroqAPI ? await window.callGroqAPI(messages, true) : null;
        window.hideLoadingScreen();
        if (reply && !reply._error) {
            const data = typeof parseAIJson === 'function' ? parseAIJson(reply) : JSON.parse(reply);
            if (data && data.calculated_seconds) {
                return data.calculated_seconds;
            }
        }
        return 0;
    } catch (e) {
        window.hideLoadingScreen();
        return 0;
    }
}

window.toggleSessionPause = function() {
    if (!activeSession) return;
    activeSession.userPaused = !activeSession.userPaused;
    const btn = document.getElementById('session-btn-pause');
    if (btn) {
        btn.innerText = activeSession.userPaused ? '▶' : '⏸';
        btn.style.color = activeSession.userPaused ? 'var(--accent-cyan)' : '';
    }
}

function sessionTick() {
    if (!activeSession || activeSession.isPaused || activeSession.userPaused) return;
    
    if (activeSession.currentIndex >= activeSession.timeline.length) return;
    
    activeSession.taskTimeLeftSecs--;
    
    // Track study time if it's not a break!
    const currentTask = activeSession.timeline[activeSession.currentIndex];
    if (currentTask && currentTask.type !== 'break' && window.trackStudyTime) {
        window.trackStudyTime(1);
    }
    
    // Update UI time efficiently
    const timeEl = document.getElementById('session-time-left');
    if (timeEl && activeSession.taskTimeLeftSecs >= 0) {
        const mins = Math.floor(activeSession.taskTimeLeftSecs / 60);
        const secs = activeSession.taskTimeLeftSecs % 60;
        timeEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (activeSession.taskTimeLeftSecs <= 0) {
        if (typeof window.skipCurrentSessionTask === 'function') {
            window.skipCurrentSessionTask();
        } else {
            activeSession.currentIndex++;
            if (activeSession.currentIndex < activeSession.timeline.length) {
                alert("Time's up! Moving to the next task: " + activeSession.timeline[activeSession.currentIndex].topic);
                activeSession.taskTimeLeftSecs = activeSession.timeline[activeSession.currentIndex].duration_mins * 60;
                renderActiveSession();
            } else {
                renderActiveSession();
            }
        }
    }
}

function autoNavigateToTask(task) {
    if (task.type === 'break') {
        // Close modals if any
        window.closeModal('exam-modal');
        window.closeModal('review-modal');
        return; 
    }
    
    if (task.type === 'review') {
        window.closeModal('exam-modal');
        if (task.docId && typeof window.switchDocument === 'function' && window.activeDocId !== task.docId) {
            window.switchDocument(task.docId);
        }
        
        setTimeout(() => {
            if (typeof window.startReview === 'function') {
                window.startReview();
            }
        }, 50);
        return;
    }
    
    // Find the document that owns this section
    let targetDocId = null;
    let targetDoc = null;
    let targetSection = null;
    
    for (const doc of activeSession.targetDocs) {
        const sec = doc.sections.find(s => s.title.toLowerCase() === task.topic.toLowerCase() || task.topic.toLowerCase().includes(s.title.toLowerCase()) || s.title.toLowerCase().includes(task.topic.toLowerCase()));
        if (sec) {
            targetDocId = doc.id;
            targetDoc = doc;
            targetSection = sec;
            break;
        }
    }
    
    if (targetDocId) {
        // Switch to the document if not already there
        if (activeDocId !== targetDocId) {
            window.switchDocument(targetDocId);
        }
        
        // Ensure UI functions exist
        if (task.type === 'summary' && window.readSummary) {
            window.closeModal('exam-modal');
            window.closeModal('review-modal');
            
            activeSession.isPaused = true;
            
            const handleSummary = async () => {
                if (!targetSection.summaryRead) {
                    await window.readSummary(targetSection.title);
                } else {
                    window.readSummary(targetSection.title);
                }
                
                const content = targetSection.summaryCache || targetSection.chunkText || "";
                if (content) {
                    const calculatedSecs = await calculateTimeWithAI('summary', content.substring(0, 50000));
                    if (calculatedSecs > 0) {
                        activeSession.taskTimeLeftSecs = calculatedSecs;
                        activeSession.timeline[activeSession.currentIndex].duration_mins = Math.ceil(calculatedSecs / 60);
                        renderActiveSession();
                    }
                }
                activeSession.isPaused = false;
            };
            
            handleSummary();
            
        } else if (task.type === 'flashcard') {
            window.closeModal('exam-modal');
            
            const evaluateAndStartFlashcards = async () => {
                let cards = [];
                if (typeof db !== 'undefined' && db.rems) {
                    cards = db.rems.filter(r => r.isFlashcard && r.docId === targetDoc.id && (r.topic === targetSection.title || (r.topic && r.topic.includes(targetSection.title))));
                }
                
                if (cards.length > 0) {
                    const flashcardTexts = cards.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n');
                    const calculatedSecs = await calculateTimeWithAI('flashcard', flashcardTexts.substring(0, 50000));
                    if (calculatedSecs > 0) {
                        activeSession.taskTimeLeftSecs = calculatedSecs;
                        activeSession.timeline[activeSession.currentIndex].duration_mins = Math.ceil(calculatedSecs / 60);
                        renderActiveSession();
                    }
                }
                
                activeSession.isPaused = false;
                if (window.startChunkReview) window.startChunkReview(targetSection.title);
            };

            let fcCount = 0;
            if (typeof db !== 'undefined' && db.rems) {
                fcCount = db.rems.filter(r => r.isFlashcard && r.docId === targetDoc.id && (r.topic === targetSection.title || (r.topic && r.topic.includes(targetSection.title)))).length;
            }
            
            if (fcCount === 0 && window.generateCards) {
                activeSession.isPaused = true;
                window.generateCards(targetSection.title).then(() => {
                    evaluateAndStartFlashcards();
                });
            } else {
                activeSession.isPaused = true;
                evaluateAndStartFlashcards();
            }
            
        } else if (task.type === 'quiz' && window.generateQuiz) {
            window.closeModal('review-modal');
            
            const evaluateAndStartQuiz = async () => {
                if (targetSection.examCache && targetSection.examCache.length > 0) {
                    const quizTexts = targetSection.examCache.map(q => `Q: ${q.q}\nOptions: ${q.options.join(', ')}\nAns: ${q.answer}`).join('\n\n');
                    const calculatedSecs = await calculateTimeWithAI('quiz', quizTexts.substring(0, 50000));
                    if (calculatedSecs > 0) {
                        activeSession.taskTimeLeftSecs = calculatedSecs;
                        activeSession.timeline[activeSession.currentIndex].duration_mins = Math.ceil(calculatedSecs / 60);
                        renderActiveSession();
                    }
                }
                
                activeSession.isPaused = false;
            };

            if (!targetSection.examTaken && window.generateQuiz) {
                activeSession.isPaused = true;
                window.generateQuiz(targetSection.title).then(() => {
                    evaluateAndStartQuiz();
                });
            } else {
                activeSession.isPaused = true;
                window.generateQuiz(targetSection.title);
                evaluateAndStartQuiz();
            }
        }
    }
}

window.skipCurrentSessionTask = function() {
    if (activeSession && activeSession.currentIndex < activeSession.timeline.length) {
        activeSession.taskTimeLeftSecs = 0; // Will trigger next task on next tick
        sessionTick();
    }
}

window.addTimeSessionTask = function() {
    if (activeSession) {
        activeSession.taskTimeLeftSecs += 5 * 60; // add 5 mins
        renderActiveSession();
    }
}
