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
        accordion.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Extracting text from PDF...</div>';

        // Extract text
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = "";
            const maxPages = pdf.numPages; // Read the entire file

            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }

            if (fullText.trim().length < 100) {
                // OCR Fallback
                accordion.innerHTML = '<div style="padding: 20px; color: var(--accent-violet); text-align: center;">Scanned PDF detected. Running OCR (Optical Character Recognition)... this may take a minute.</div>';

                fullText = "";
                let ocrPagesStr = prompt(`Scanned PDF detected (${pdf.numPages} total pages). OCR scanning takes a few seconds per page. Enter a number to scan from the beginning (e.g., "10") or a range (e.g., "15-30"):`, "10");

                let startPage = 1;
                let endPage = 10;

                if (ocrPagesStr && ocrPagesStr.includes('-')) {
                    const parts = ocrPagesStr.split('-');
                    startPage = Math.max(1, parseInt(parts[0]) || 1);
                    endPage = Math.min(pdf.numPages, parseInt(parts[1]) || pdf.numPages);
                    if (startPage > endPage) {
                        const temp = startPage;
                        startPage = endPage;
                        endPage = temp;
                    }
                } else {
                    endPage = Math.min(pdf.numPages, parseInt(ocrPagesStr) || 10);
                }

                const totalPagesToScan = endPage - startPage + 1;
                let pagesScanned = 0;

                // create a temporary canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Initialize Tesseract worker
                const worker = await Tesseract.createWorker('eng');

                for (let i = startPage; i <= endPage; i++) {
                    pagesScanned++;
                    accordion.innerHTML = `<div style="padding: 20px; color: var(--accent-violet); text-align: center;">Scanning page ${i} (Progress: ${pagesScanned} of ${totalPagesToScan}) using OCR...</div>`;
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 }); // Good balance of speed/accuracy

                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                    // Run OCR
                    const ret = await worker.recognize(canvas);
                    fullText += ret.data.text + "\n";
                }

                await worker.terminate();
            }

            // Call AI to generate sections
            if (window.generateStudyPlan) {
                await window.generateStudyPlan(fullText, file.name);
            }

        } catch (error) {
            console.error("PDF Processing Error", error);
            accordion.innerHTML = '<div style="padding: 20px; color: var(--accent-rose); text-align: center;">Error extracting PDF text. Please ensure the file is not corrupted or password protected.</div>';
        }
    } else {
        alert("Please upload a valid PDF file.");
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

    doc.sections.forEach((sec, idx) => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        if (idx === 0) item.classList.add('expanded');
        item.style.animationDelay = `${idx * 0.06}s`;

        item.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span><span class="acc-num">${idx + 1}</span> ${sec.title}</span>
                <span class="header-right"><span class="progress-badge">0%</span> ${idx === 0 ? '⌃' : '⌄'}</span>
            </div>
            <div class="accordion-content">
                
                <div class="next-step-block">
                    <div class="next-step-header">Next Step</div>
                    <div class="next-step-body">
                        <div class="next-step-title">📖 Read</div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-dark-pill" onclick="readSummary('${sec.title.replace(/'/g, "\\'")}')">📑 Read Summary</button>
                            <button class="btn-dark-pill" onclick="window.switchLeftView('pdf-view', document.querySelectorAll('#left-pane-tabs .left-tab-item')[0])">📄 Read PDF</button>
                        </div>
                    </div>
                </div>

                <div class="action-cards-grid">
                    <div class="action-card card-purple">
                        <span style="font-weight:700; display:flex; align-items:center; gap:8px;">🃏 Flashcards</span>
                        ${sec.flashcardsGenerated ? `<button class="btn-action" style="background: rgba(16,185,129,0.2); color: var(--accent-emerald); border: 1px solid rgba(16,185,129,0.3); cursor:default;" disabled>✅ Cards Generated</button>` : `<button class="btn-action" onclick="generateCards('${sec.title.replace(/'/g, "\\'")}')">Generate Cards</button>`}
                    </div>
                    <div class="action-card card-green">
                        <span style="font-weight:700; display:flex; align-items:center; gap:8px;">❓ Quiz</span>
                        <button class="btn-action" onclick="generateQuiz('${sec.title.replace(/'/g, "\\'")}')">Take Exam</button>
                    </div>
                </div>
                
            </div>
        `;
        container.appendChild(item);
    });
}