// Tablet Drawing & Annotation Logic

let currentDrawMode = null; // 'pen', 'highlight', or null
let isDrawing = false;
let lastX = 0;
let lastY = 0;

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Resize canvas to fit left pane
    function resizeCanvas() {
        const pane = document.getElementById('left-pane');
        if (pane && canvas) {
            canvas.width = pane.clientWidth;
            canvas.height = pane.clientHeight;
        }
    }
    
    window.addEventListener('resize', resizeCanvas);
    // Initial delay to ensure layout is done
    setTimeout(resizeCanvas, 500);

    // Event Listeners for drawing
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events for tablet
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    function startDrawing(e) {
        if (!currentDrawMode) return;
        isDrawing = true;
        
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        if (e.type === 'touchstart') {
            e.preventDefault(); // Prevent scrolling while drawing
        }
    }
    
    function draw(e) {
        if (!isDrawing || !currentDrawMode) return;
        
        const pos = getPos(e);
        const currentX = pos.x;
        const currentY = pos.y;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        
        if (currentDrawMode === 'pen') {
            ctx.strokeStyle = '#f43f5e'; // Rose color for pen
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'source-over';
        } else if (currentDrawMode === 'highlight') {
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)'; // Yellow semi-transparent
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'multiply';
        }
        
        ctx.stroke();
        
        lastX = currentX;
        lastY = currentY;
        
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
    }
    
    function stopDrawing() {
        isDrawing = false;
    }
    
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
});

window.toggleDrawingMode = function(mode) {
    const canvas = document.getElementById('drawing-canvas');
    const penBtn = document.getElementById('tool-pen');
    const highlightBtn = document.getElementById('tool-highlight');
    
    penBtn.classList.remove('active');
    highlightBtn.classList.remove('active');
    
    if (currentDrawMode === mode) {
        // Toggle off
        currentDrawMode = null;
        canvas.style.pointerEvents = 'none';
    } else {
        // Toggle on
        currentDrawMode = mode;
        canvas.style.pointerEvents = 'auto';
        if (mode === 'pen') penBtn.classList.add('active');
        if (mode === 'highlight') highlightBtn.classList.add('active');
    }
};

window.clearCanvas = function() {
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};
