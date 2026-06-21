// PDF Upload and Processing Logic

window.handleFileUpload = async function (event) {
    const file = event.target.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {

        if (!activeDocId) {
            const docId = Math.random().toString(36).substr(2, 9);
            const subjectId = db.subjects && db.subjects.length > 0 ? db.subjects[0].id : 's1';
            const cleanTitle = file.name.replace(/\.pdf$/i, '');
            db.documents.push({ id: docId, title: cleanTitle, created: Date.now(), pdfContextText: "", sections: [], subjectId });
            if (window.addRem) window.addRem(docId, "", 0);
            saveDb();
            window.switchDocument(docId);
        } else {
            const doc = getActiveDoc();
            if (doc && doc.title === 'Untitled Document') {
                doc.title = file.name.replace(/\.pdf$/i, '');
                saveDb();
                if (window.refreshAppUI) window.refreshAppUI();
            }
        }

        const fileURL = URL.createObjectURL(file);

        // Switch to PDF View using new left pane tabs
        if (window.switchLeftView) {
            const leftTabs = document.querySelectorAll('#left-pane-tabs .left-tab-item');
            window.switchLeftView('pdf-view', leftTabs[0]);
        }

        // Hide overlay, show iframe
        document.getElementById('upload-overlay').style.display = 'none';
        const embed = document.getElementById('pdf-iframe');
        embed.src = fileURL + "#toolbar=1&navpanes=0&scrollbar=1";
        embed.style.display = 'block';

        // Show loading in Study Plan
        if (window.switchRightView) window.switchRightView('learn-view', document.querySelectorAll('.right-tabs .right-tab-item')[1]);
        const accordion = document.getElementById('accordion-container');
        accordion.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Reading document...</div>';

        // Extract text
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            // Check if first page has text
            const page1 = await pdf.getPage(1);
            const textContent = await page1.getTextContent();
            const hasText = textContent.items.length > 10;
            
            // Store globally temporarily so the modal can access it
            window.currentPendingPdf = pdf;
            window.currentPendingFilename = file.name;
            
            // Open Modal
            document.getElementById('upload-start-page').value = 1;
            document.getElementById('upload-end-page').value = Math.min(10, pdf.numPages);
            document.getElementById('upload-max-pages').innerText = `(Max: ${pdf.numPages})`;
            
            if (hasText) {
                document.getElementById('upload-modal-title').innerText = "Scan Document Settings";
                window.currentPendingNeedsOCR = false;
            } else {
                document.getElementById('upload-modal-title').innerText = "OCR Settings (Scanned PDF Detected)";
                window.currentPendingNeedsOCR = true;
            }
            
            window.openModal('upload-settings-modal');

        } catch (error) {
            console.error("PDF Read Error", error);
            accordion.innerHTML = '<div style="padding: 20px; color: var(--accent-rose); text-align: center;">Error reading PDF file. Please ensure it is not corrupted or password protected.</div>';
        }
    } else {
        alert("Please upload a valid PDF file.");
    }
}

window.startPdfProcessing = async function() {
    window.closeModal('upload-settings-modal');
    
    const pdf = window.currentPendingPdf;
    const filename = window.currentPendingFilename;
    const needsOCR = window.currentPendingNeedsOCR;
    
    if (!pdf) return;
    
    let startPage = parseInt(document.getElementById('upload-start-page').value) || 1;
    let endPage = parseInt(document.getElementById('upload-end-page').value) || pdf.numPages;
    
    // Validate
    startPage = Math.max(1, startPage);
    endPage = Math.min(pdf.numPages, endPage);
    if (startPage > endPage) {
        let temp = startPage;
        startPage = endPage;
        endPage = temp;
    }
    
    let scale = 2.5; // best (High resolution)
    
    const accordion = document.getElementById('accordion-container');
    let fullText = "";
    
    try {
        if (!needsOCR) {
            const totalPagesToScan = endPage - startPage + 1;
            let pagesScanned = 0;
            for (let i = startPage; i <= endPage; i++) {
                pagesScanned++;
                accordion.innerHTML = `<div style="padding: 20px; color: var(--text-muted); text-align: center;">Extracting text from page ${i} (Progress: ${pagesScanned} of ${totalPagesToScan})...</div>`;
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }
        } else {
            const totalPagesToScan = endPage - startPage + 1;
            let pagesScanned = 0;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            accordion.innerHTML = `<div style="padding: 20px; color: var(--accent-violet); text-align: center;">Initializing Advanced OCR Engine...</div>`;
            const worker = await Tesseract.createWorker('eng', 1, {
                langPath: 'https://tessdata.projectnaptha.com/4.0.0_best'
            });
            await worker.setParameters({
                tessedit_pageseg_mode: '3', // Fully automatic page segmentation
            });
            
            for (let i = startPage; i <= endPage; i++) {
                pagesScanned++;
                accordion.innerHTML = `<div style="padding: 20px; color: var(--accent-violet); text-align: center;">Scanning page ${i} (Progress: ${pagesScanned} of ${totalPagesToScan}) using Advanced OCR...</div>`;
                const page = await pdf.getPage(i);
                
                // Increase scale for better OCR accuracy
                const viewport = page.getViewport({ scale: scale * 1.5 });
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                
                // Advanced Image Preprocessing
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let p = 0; p < data.length; p += 4) {
                    const avg = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114);
                    // Binarization (thresholding)
                    const color = avg > 150 ? 255 : 0;
                    data[p] = color;
                    data[p + 1] = color;
                    data[p + 2] = color;
                }
                ctx.putImageData(imageData, 0, 0);
                
                const ret = await worker.recognize(canvas);
                fullText += ret.data.text + "\n";
            }
            
            await worker.terminate();
        }
        
        // Call AI to generate sections
        if (window.generateStudyPlan) {
            await window.generateStudyPlan(fullText, filename);
        }
    } catch (error) {
        console.error("PDF Processing Error", error);
        accordion.innerHTML = '<div style="padding: 20px; color: var(--accent-rose); text-align: center;">Error extracting PDF text. Please ensure the file is not corrupted or password protected.</div>';
    }
}

window.renderAccordionSections = function () {
    const container = document.getElementById('accordion-container');
    if (!container) return;

    container.innerHTML = '';

    const doc = window.getActiveDoc ? window.getActiveDoc() : null;
    if (!doc || !doc.sections || doc.sections.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Upload a PDF to generate a study plan.</div>';
        return;
    }

    const globalActions = document.createElement('div');
    globalActions.style.display = 'flex';
    globalActions.style.flexDirection = 'column';
    globalActions.style.gap = '10px';
    globalActions.style.marginBottom = '20px';
    
    let topRow = '<div style="display:flex; gap:10px;">';
    topRow += `<button class="btn-action primary" style="flex:1; padding: 12px; font-size: 1rem; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);" onclick="window.openGlobalCustomModal('exam')">📝 New Custom Exam</button>`;
    if (doc.customExam && doc.customExam.questions && doc.customExam.questions.length > 0) {
        topRow += `<button class="btn-action" style="flex:1; padding: 12px; font-size: 1rem; background: rgba(16,185,129,0.2); color: var(--accent-emerald); border: 1px solid rgba(16,185,129,0.3);" onclick="window.retakeCustomExam()">✅ Retake Saved Exam</button>`;
    }
    topRow += '</div>';

    let bottomRow = '<div style="display:flex; gap:10px;">';
    bottomRow += `<button class="btn-action primary" style="flex:1; padding: 12px; font-size: 1rem; background: rgba(139, 92, 246, 0.2); color: var(--accent-violet); border: 1px solid rgba(139, 92, 246, 0.5);" onclick="window.openGlobalCustomModal('flashcard')">🃏 Generate Custom Flashcards</button>`;
    bottomRow += '</div>';

    globalActions.innerHTML = topRow + bottomRow;
    container.appendChild(globalActions);

    doc.sections.forEach((sec, idx) => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        if (idx === 0) item.classList.add('expanded');
        item.style.animationDelay = `${idx * 0.06}s`;

        let mastery = 0;
        if (sec.summaryRead) mastery += 33;
        if (sec.flashcardsGenerated) mastery += 33;
        if (sec.examTaken) mastery += 34;

        let badgeStyle = '';
        let badgeText = `${mastery}%`;
        if (mastery === 100) {
            badgeStyle = 'background: linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2)); color: var(--accent-cyan); border-color: rgba(6,182,212,0.5); box-shadow: 0 0 10px rgba(6,182,212,0.2);';
            badgeText = '🌟 100% Mastered';
        }

        item.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span style="display:flex; align-items:center; gap: 8px;">
                    <input type="checkbox" ${sec.isStudied ? 'checked' : ''} 
                           onclick="event.stopPropagation(); window.toggleStudied(this, '${sec.title.replace(/'/g, "\\'")}')" 
                           title="Mark as studied"
                           style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);">
                    <span><span class="acc-num">${idx + 1}</span> ${sec.title}</span>
                </span>
                <span class="header-right"><span class="progress-badge" style="${badgeStyle}">${badgeText}</span> ${idx === 0 ? '⌃' : '⌄'}</span>
            </div>
            <div class="accordion-content">
                
                <div class="next-step-block">
                    <div class="next-step-header">Next Step</div>
                    <div class="next-step-body">
                        <div class="next-step-title">📖 Read</div>
                        <div style="display:flex; gap:10px;">
                            ${sec.summaryRead ? 
                                `<button class="btn-dark-pill" style="border-color:var(--accent-emerald); color:var(--accent-emerald)" onclick="readSummary('${sec.title.replace(/'/g, "\\'")}')">✅ Summary Read</button>` : 
                                `<button class="btn-dark-pill" onclick="readSummary('${sec.title.replace(/'/g, "\\'")}')">📑 Read Summary</button>`}
                            <button class="btn-dark-pill" onclick="window.switchLeftView('pdf-view', document.querySelectorAll('#left-pane-tabs .left-tab-item')[0])">📄 Read PDF</button>
                        </div>
                    </div>
                </div>

                <div class="action-cards-grid">
                    <div class="action-card card-purple">
                        <span style="font-weight:700; display:flex; align-items:center; gap:8px;">🃏 Flashcards</span>
                        ${sec.flashcardsGenerated ? `<button class="btn-action" style="background: rgba(16,185,129,0.2); color: var(--accent-emerald); border: 1px solid rgba(16,185,129,0.3);" onclick="startChunkReview('${sec.title.replace(/'/g, "\\'")}')">✅ Cards Generated (Practice)</button>` : `<button class="btn-action" onclick="generateCards('${sec.title.replace(/'/g, "\\'")}')">Generate Cards</button>`}
                    </div>
                    <div class="action-card card-green">
                        <span style="font-weight:700; display:flex; align-items:center; gap:8px;">❓ Quiz</span>
                        ${sec.examTaken ? `<button class="btn-action" style="background: rgba(16,185,129,0.2); color: var(--accent-emerald); border: 1px solid rgba(16,185,129,0.3);" onclick="generateQuiz('${sec.title.replace(/'/g, "\\'")}')">✅ Exam Taken</button>` : `<button class="btn-action" onclick="generateQuiz('${sec.title.replace(/'/g, "\\'")}')">Take Exam</button>`}
                    </div>
                </div>
                
            </div>
        `;
        container.appendChild(item);
    });
}

window.toggleStudied = function(checkbox, secTitle) {
    const doc = window.getActiveDoc ? window.getActiveDoc() : null;
    if (!doc || !doc.sections) return;
    const sec = doc.sections.find(s => s.title === secTitle);
    if (sec) {
        sec.isStudied = checkbox.checked;
        if (typeof saveDb === 'function') saveDb();
    }
};