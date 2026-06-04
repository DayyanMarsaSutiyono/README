// ocr.js
// Modul ini menangani upload gambar, drag & drop, preprocessing canvas, OCR plat nomor, dan fallback manual.

const plateImageInput = document.getElementById('plateImageInput');
const plateImageSelectBtn = document.getElementById('plateImageSelectBtn');
const ocrDropzone = document.getElementById('ocrDropzone');
const ocrPreviewContainer = document.getElementById('ocrPreviewContainer');
const ocrPreviewCanvas = document.getElementById('ocrPreviewCanvas');
const ocrResultText = document.getElementById('ocrResultText');
const ocrConfidenceText = document.getElementById('ocrConfidenceText');
const ocrStatus = document.getElementById('ocrStatus');
const ocrSpinner = document.getElementById('ocrSpinner');
const runOcrBtn = document.getElementById('runOcrBtn');
const resetOcrBtn = document.getElementById('resetOcrBtn');
const ocrFallback = document.getElementById('ocrFallback');
const platNomorInput = document.getElementById('platNomor');

let selectedImageFile = null;
let currentCanvas = null;
let currentStatusClass = '';

function setupOcrFeature() {
    if (!plateImageInput || !plateImageSelectBtn || !ocrDropzone || !runOcrBtn || !resetOcrBtn) {
        return;
    }

    plateImageSelectBtn.addEventListener('click', () => plateImageInput.click());
    plateImageInput.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file) {
            handleImageFile(file);
        }
    });

    ocrDropzone.addEventListener('click', () => plateImageInput.click());
    ocrDropzone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            plateImageInput.click();
        }
    });

    ocrDropzone.addEventListener('dragenter', handleDragEnter);
    ocrDropzone.addEventListener('dragover', handleDragOver);
    ocrDropzone.addEventListener('dragleave', handleDragLeave);
    ocrDropzone.addEventListener('drop', handleDrop);

    runOcrBtn.addEventListener('click', performOcr);
    resetOcrBtn.addEventListener('click', resetOcrArea);

    if (!window.Tesseract) {
        updateOcrStatus('Gagal memuat library OCR. Periksa koneksi internet atau CDN.', 'error');
        runOcrBtn.disabled = true;
        plateImageSelectBtn.disabled = true;
    }
}

function handleDragEnter(event) {
    event.preventDefault();
    ocrDropzone.classList.add('drag-over');
}

function handleDragOver(event) {
    event.preventDefault();
    ocrDropzone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    ocrDropzone.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    ocrDropzone.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file) {
        handleImageFile(file);
    }
}

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        updateOcrStatus('File bukan gambar. Unggah file JPG atau PNG.', 'error');
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(imageUrl);
        if (image.width < 300 || image.height < 120) {
            updateOcrStatus('Gambar terlalu kecil. Gunakan foto dengan resolusi minimal 300x120.', 'error');
            selectedImageFile = null;
            return;
        }
        selectedImageFile = file;
        prepareCanvas(image);
        ocrPreviewContainer.classList.remove('hidden');
        updateOcrStatus('Gambar berhasil dipilih. Jalankan OCR untuk mendeteksi plat.', 'success');
        ocrFallback.classList.add('hidden');
    };
    image.onerror = () => {
        updateOcrStatus('Tidak dapat membaca gambar. Coba gambar lain atau periksa ekstensi file.', 'error');
        selectedImageFile = null;
    };
    image.src = imageUrl;
}

function prepareCanvas(image) {
    const canvas = ocrPreviewCanvas;
    const context = canvas.getContext('2d');
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    preprocessCanvas(context, canvas.width, canvas.height);
    currentCanvas = canvas;
}

function preprocessCanvas(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const gray = Math.round((red * 0.299) + (green * 0.587) + (blue * 0.114));
        data[i] = data[i + 1] = data[i + 2] = gray;
    }

    const contrast = 1.2;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * contrast + intercept);
        data[i + 1] = clamp(data[i + 1] * contrast + intercept);
        data[i + 2] = clamp(data[i + 2] * contrast + intercept);
    }

    context.putImageData(imageData, 0, 0);
}

function clamp(value) {
    return Math.max(0, Math.min(255, value));
}

async function performOcr() {
    if (!selectedImageFile || !currentCanvas) {
        updateOcrStatus('Pilih gambar plat nomor terlebih dahulu sebelum menjalankan OCR.', 'warning');
        return;
    }

    if (!window.Tesseract) {
        updateOcrStatus('Library Tesseract tidak tersedia. OCR tidak dapat dijalankan.', 'error');
        return;
    }

    runOcrBtn.disabled = true;
    plateImageSelectBtn.disabled = true;
    showSpinner(true);
    updateOcrStatus('OCR sedang dijalankan. Mohon tunggu beberapa detik...', 'warning');

    try {
        const worker = window.Tesseract.createWorker({
            logger: message => {
                if (message.status === 'recognizing text') {
                    updateOcrStatus(`OCR berjalan: ${Math.round(message.progress * 100)}%`, 'warning');
                }
            }
        });

        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            preserve_interword_spaces: '1'
        });

        const { data } = await worker.recognize(currentCanvas);
        await worker.terminate();

        const rawText = data.text || '';
        const cleaned = normalizeOcrText(rawText);
        const formatted = formatPlateNumber(cleaned);
        const confidence = Math.round(data.confidence || 0);

        ocrResultText.textContent = `Hasil: ${formatted || '-'}`;
        ocrConfidenceText.textContent = `Confidence: ${confidence}%`;

        if (!formatted) {
            updateOcrStatus('Teks plat nomor tidak terdeteksi dengan baik. Silakan masukkan manual.', 'error');
            ocrFallback.classList.remove('hidden');
            return;
        }

        platNomorInput.value = formatted;

        if (confidence < 60) {
            updateOcrStatus(`Hasil OCR ditemukan tetapi confidence rendah (${confidence}%). Periksa kembali atau masukkan manual.`, 'warning');
            ocrFallback.classList.remove('hidden');
            setPreviewState('warning');
            return;
        }

        updateOcrStatus(`Berhasil! Plat nomor dideteksi sebagai ${formatted} dengan confidence ${confidence}%.`, 'success');
        setPreviewState('success');
        ocrFallback.classList.add('hidden');
    } catch (error) {
        updateOcrStatus('OCR gagal dijalankan. Periksa koneksi dan coba lagi.', 'error');
        ocrFallback.classList.remove('hidden');
    } finally {
        runOcrBtn.disabled = false;
        plateImageSelectBtn.disabled = false;
        showSpinner(false);
    }
}

function normalizeOcrText(text) {
    return text
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatPlateNumber(text) {
    if (!text) {
        return '';
    }

    const patterns = [
        /([A-Z]{1,2})\s*([0-9]{1,4})\s*([A-Z]{1,3})/, // B 1234 ABC
        /([A-Z]{1,2})([0-9]{1,4})([A-Z]{1,3})/, // B1234ABC tanpa spasi
        /([A-Z]{1,2})\s*([0-9]{1,4})/, // B 1234
        /([A-Z]{1,2})([0-9]{1,4})/ // B1234
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const group1 = match[1];
            const group2 = match[2];
            const group3 = match[3] || '';
            const prefix = group1;
            const number = group2;
            const suffix = group3;
            return suffix ? `${prefix} ${number} ${suffix}` : `${prefix} ${number}`;
        }
    }

    return '';
}

function updateOcrStatus(message, type) {
    ocrStatus.textContent = `Status OCR: ${message}`;
    ocrStatus.classList.remove('success', 'warning', 'error');
    if (type) {
        ocrStatus.classList.add(type);
        currentStatusClass = type;
    }
}

function setPreviewState(type) {
    ocrPreviewContainer.classList.remove('success', 'warning', 'error');
    if (type) {
        ocrPreviewContainer.classList.add(type);
    }
}

function showSpinner(show) {
    if (show) {
        ocrSpinner.classList.remove('hidden');
        ocrSpinner.textContent = 'Memproses gambar...';
        return;
    }
    ocrSpinner.classList.add('hidden');
    ocrSpinner.textContent = '';
}

function resetOcrArea() {
    selectedImageFile = null;
    currentCanvas = null;
    ocrPreviewContainer.classList.add('hidden');
    ocrFallback.classList.add('hidden');
    ocrResultText.textContent = 'Hasil: -';
    ocrConfidenceText.textContent = 'Confidence: -';
    updateOcrStatus('OCR telah direset. Unggah ulang gambar untuk mencoba lagi.', 'warning');
    setPreviewState('');
    plateImageInput.value = '';
}

function displayLocalWarning(message) {
    if (typeof showAlert === 'function') {
        showAlert(message, 'warning');
    }
}

document.addEventListener('DOMContentLoaded', setupOcrFeature);
