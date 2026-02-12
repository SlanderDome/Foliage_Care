/**
 * Foliage Care — Drag & Drop Upload Zone Logic
 * Handles: drag events, file preview, image remove button,
 * and toggling between empty-state and preview-state.
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('photo');
    const prompt = document.getElementById('drop-zone-prompt');
    const preview = document.getElementById('drop-zone-preview');
    const previewImage = document.getElementById('preview-image');
    const removeBtn = document.getElementById('remove-image-btn');
    const resultsEmpty = document.getElementById('results-empty');
    const diseaseGroup = document.getElementById('disease-info-group');

    if (!dropZone) return;

    // ── Drag visual feedback ──
    const dragEvents = ['dragenter', 'dragover'];
    dragEvents.forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    // ── Handle drop ──
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            fileInput.files = files;             // Assign to the real input
            showPreview(files[0]);
            fileInput.dispatchEvent(new Event('change')); // trigger up.js listener
        }
    });

    // ── Handle file input change (also triggered by up.js) ──
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) showPreview(file);
    });

    // ── Show preview ──
    function showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            prompt.style.display = 'none';
            preview.classList.add('active');
        };
        reader.readAsDataURL(file);
    }

    // ── Remove image ──
    removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = '';
        previewImage.src = '#';
        preview.classList.remove('active');
        prompt.style.display = 'flex';

        // Reset results side
        if (resultsEmpty) resultsEmpty.style.display = '';
        if (diseaseGroup) diseaseGroup.style.display = 'none';

        const visualResult = document.getElementById('visual-result');
        const simSection = document.getElementById('simulation-section');
        if (visualResult) visualResult.style.display = 'none';
        if (simSection) simSection.style.display = 'none';
    });
});
