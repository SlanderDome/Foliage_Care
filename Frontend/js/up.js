// ═══════════════════════════════════════════════
//  FOLIAGE CARE: CONSULTATION THREAD ENGINE v2.1
//  Migrated for pure Gemini Vision backend.
//  Breaking changes from v1:
//    result.class              → result.diagnosis.disease
//    result.confidence         → result.diagnosis.confidence
//    result.prevention_measures→ result.action_plan (object)
//    result.explanation_image  → result.visual_evidence.affected_regions (coords)
//    result.message            → result.message (invalid image)
// ═══════════════════════════════════════════════

// --- DOM Elements ---
const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const previewImage = document.getElementById("preview-image");
const resultsEmpty = document.getElementById("results-empty");
const threadContainer = document.getElementById("thread-container");
const threadEntries = document.getElementById("thread-entries");
const fieldNoteInput = document.getElementById("field-note-input");

// Stepper
const stepperSteps = document.querySelectorAll('.stepper-step');
const stepperLines = document.querySelectorAll('.stepper-line');

// Unified section
const unifiedSection = document.getElementById("unified-section");
const locationInput = document.getElementById("user-location");
const contextInput = document.getElementById("user-context");
const globalLoader = document.getElementById("global-loader");

// Simulation
const simulateBtn = document.getElementById("simulate-btn");
const futureImg = document.getElementById("future-image");

// Expert plan
const planBtn = document.getElementById("get-plan-btn");
const expertResult = document.getElementById("expert-result");

// Follow-up
const followupBar = document.getElementById("followup-bar");
const followupInput = document.getElementById("followup-input");
const followupSend = document.getElementById("followup-send");

// ═══════════ GLOBAL STATE ═══════════
let detectedDiseaseName = "";
let detectedPlantName = "";
let userCoordinates = null;
let conversationHistory = [];
let lastDiagnosisResult = null;

// ═══════════ HELPERS ═══════════

function getUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            console.log("📍 Location captured:", userCoordinates);
            const locInput = document.getElementById("user-location");
            if (locInput && !locInput.value) {
                locInput.value = `${userCoordinates.lat.toFixed(4)}, ${userCoordinates.lng.toFixed(4)}`;
            }
        },
        () => { console.warn("⚠️ Location access denied."); },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

function getTimeString() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getUserName() {
    const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
    return user ? (user.displayName || "Farmer") : "Farmer";
}

function getUserType() {
    const selected = document.querySelector('.user-type-pill.selected');
    return selected ? selected.dataset.value : "home_gardener";
}

// --- Partial JSON Salvager ---
function salvagePartialJSON(rawStr) {
    console.warn("Attempting to salvage partial JSON stream...");

    // Default fallback structure so the UI doesn't crash
    const salvaged = {
        diagnosis: { plant: 'Unknown', plant_hindi: '', disease: 'Unknown issue', severity: 'mild', confidence: 0.5 },
        visual_evidence: {},
        trust_signals: {},
        action_plan: { immediate_action: "Keep the plant isolated until a full scan can be completed." }
    };

    // Regex out the critical fields if they managed to generate
    const plantMatch = rawStr.match(/"plant":\s*"([^"]+)"/);
    if (plantMatch) salvaged.diagnosis.plant = plantMatch[1];

    const hindiMatch = rawStr.match(/"plant_hindi":\s*"([^"]+)"/);
    if (hindiMatch) salvaged.diagnosis.plant_hindi = hindiMatch[1];

    const diseaseMatch = rawStr.match(/"disease":\s*"([^"]+)"/);
    if (diseaseMatch) salvaged.diagnosis.disease = diseaseMatch[1];

    const severityMatch = rawStr.match(/"severity":\s*"([^"]+)"/);
    if (severityMatch) salvaged.diagnosis.severity = severityMatch[1];

    return salvaged;
}

// --- Stepper ---
function setStep(stepNum) {
    stepperSteps.forEach((s, i) => {
        const n = i + 1;
        s.classList.toggle('active', n <= stepNum);
        s.classList.toggle('completed', n < stepNum);
    });
    stepperLines.forEach((line, i) => {
        line.classList.toggle('filled', i < stepNum - 1);
    });
}

// --- Confidence gauge animation ---
function animateGauge(gaugeContainer, percent) {
    gaugeContainer.style.display = 'flex';
    const fill = gaugeContainer.querySelector('.gauge-fill');
    const value = gaugeContainer.querySelector('.gauge-value');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percent / 100) * circumference;

    let color = '#2D5016';
    if (percent < 65) color = '#C0392B';
    else if (percent < 85) color = '#D4A017';

    fill.style.stroke = color;
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
        fill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)';
        fill.style.strokeDashoffset = offset;
    });

    const duration = 1500;
    const start = performance.now();
    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        value.textContent = (eased * percent).toFixed(1) + '%';
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// --- Severity badge ---
function buildSeverityBadge(severity) {
    const map = {
        none: { bg: '#EAF3DE', color: '#2D5016', label: 'Healthy ✓' },
        mild: { bg: '#FDF3D0', color: '#854F0B', label: 'Mild issue' },
        moderate: { bg: '#FAECE7', color: '#993C1D', label: 'Moderate' },
        severe: { bg: '#FCEBEB', color: '#A32D2D', label: 'Severe — act now' },
    };
    const s = map[severity] || map['mild'];
    return `<span style="
        background:${s.bg};
        color:${s.color};
        font-size:11px;
        font-weight:500;
        padding:3px 10px;
        border-radius:999px;
        display:inline-block;
        margin-left:8px;
        vertical-align:middle;
    ">${s.label}</span>`;
}

// --- Action plan renderer ---
function buildActionPlanHTML(actionPlan) {
    if (!actionPlan) return '';
    const steps = [
        { icon: '⚡', title: 'Do this today', body: actionPlan.immediate_action, borderColor: '#C0392B' },
        { icon: '🌿', title: 'Desi / organic treatment', body: actionPlan.desi_remedy, borderColor: '#5C8A2E' },
        {
            icon: '⚗️', title: 'If it gets worse',
            body: actionPlan.organic_option
                ? actionPlan.organic_option + (actionPlan.chemical_option ? '<br><br>' + actionPlan.chemical_option : '')
                : actionPlan.chemical_option,
            borderColor: '#D4A017'
        },
    ];

    const stepsHTML = steps.filter(s => s.body).map(s => `
        <div style="border-left:3px solid ${s.borderColor};padding:10px 14px;margin-bottom:10px;background:var(--bg-card,#fff);border-radius:0 8px 8px 0;">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${s.icon} ${s.title}</div>
            <div style="font-size:13px;line-height:1.6;color:var(--text-secondary,#555);">${s.body}</div>
        </div>
    `).join('');

    const seasonTip = actionPlan.seasonal_tip
        ? `<div style="background:#EAF3DE;border-radius:8px;padding:10px 14px;font-size:12px;color:#2D5016;margin-top:4px;">🌦️ <strong>Seasonal tip:</strong> ${actionPlan.seasonal_tip}</div>`
        : '';

    return `<div style="margin-top:12px;">${stepsHTML}${seasonTip}</div>`;
}

// --- Trust signals renderer ---
function buildTrustSignalsHTML(trustSignals) {
    if (!trustSignals) return '';
    const items = [
        { icon: '✓', color: '#5C8A2E', text: trustSignals.why_this_diagnosis },
        { icon: '≈', color: '#888780', text: trustSignals.alternative_diagnosis },
        { icon: 'ℹ', color: '#D4A017', text: trustSignals.confidence_explanation },
    ].filter(i => i.text && i.text !== 'None');
    if (!items.length) return '';

    const rows = items.map(i => `
        <div style="display:flex;gap:8px;margin-bottom:6px;font-size:12px;line-height:1.5;">
            <span style="color:${i.color};font-weight:700;min-width:14px;">${i.icon}</span>
            <span style="color:var(--text-secondary,#555);">${i.text}</span>
        </div>
    `).join('');

    return `
        <details style="margin-top:12px;">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-muted,#888);list-style:none;user-select:none;">Why we think this ▾</summary>
            <div style="margin-top:8px;padding:10px 12px;background:var(--bg-surface,#F8F4EC);border-radius:8px;">${rows}</div>
        </details>
    `;
}


// --- Region overlay (replaces Grad-CAM) ---
function drawRegionOverlay(imgElement, regions) {
    if (!regions || !regions.length) return;

    function draw() {
        const wrapper = imgElement.parentElement;
        if (!wrapper) return;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        const existing = wrapper.querySelector('.region-overlay-canvas');
        if (existing) existing.remove();

        const canvas = document.createElement('canvas');
        canvas.className = 'region-overlay-canvas';
        canvas.width = imgElement.naturalWidth || imgElement.offsetWidth;
        canvas.height = imgElement.naturalHeight || imgElement.offsetHeight;
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;';
        wrapper.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        regions.forEach((region, idx) => {
            setTimeout(() => {
                const x = region.x_pct * W;
                const y = region.y_pct * H;
                const w = region.w_pct * W;
                const h = region.h_pct * H;

                ctx.fillStyle = 'rgba(212, 160, 23, 0.08)';
                ctx.fillRect(x, y, w, h);

                let progress = 0;
                const perimeter = 2 * (w + h);
                const duration = 600;
                const startTime = performance.now();

                function animateBox(now) {
                    const elapsed = now - startTime;
                    progress = Math.min(elapsed / duration, 1);
                    const drawn = progress * perimeter;

                    ctx.clearRect(x - 2, y - 2, w + 4, h + 4);
                    ctx.fillStyle = 'rgba(212, 160, 23, 0.08)';
                    ctx.fillRect(x, y, w, h);

                    ctx.strokeStyle = '#D4A017';
                    ctx.lineWidth = 2;
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';

                    ctx.beginPath();
                    let remaining = drawn;
                    if (remaining > 0) { const seg = Math.min(remaining, w); ctx.moveTo(x, y); ctx.lineTo(x + seg, y); remaining -= seg; }
                    if (remaining > 0) { const seg = Math.min(remaining, h); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + seg); remaining -= seg; }
                    if (remaining > 0) { const seg = Math.min(remaining, w); ctx.moveTo(x + w, y + h); ctx.lineTo(x + w - seg, y + h); remaining -= seg; }
                    if (remaining > 0) { const seg = Math.min(remaining, h); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h - seg); }
                    ctx.stroke();

                    if (region.label) {
                        ctx.globalAlpha = progress;
                        ctx.fillStyle = 'rgba(212, 160, 23, 0.92)';
                        const labelW = ctx.measureText(region.label).width + 12;
                        const labelH = 18;
                        const labelX = x;
                        const labelY = y - labelH - 2 < 0 ? y + 2 : y - labelH - 2;
                        ctx.fillRect(labelX, labelY, labelW, labelH);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = '500 11px "DM Sans", sans-serif';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(region.label, labelX + 6, labelY + labelH / 2);
                        ctx.globalAlpha = 1;
                    }

                    if (progress < 1) requestAnimationFrame(animateBox);
                }
                requestAnimationFrame(animateBox);
            }, idx * 150);
        });
    }

    if (imgElement.complete && imgElement.naturalWidth) { draw(); }
    else { imgElement.addEventListener('load', draw, { once: true }); }
}

// ═══════════ THREAD ENTRY SYSTEM ═══════════

function addThreadEntry(type, content, extraHTML = '') {
    const entry = document.createElement('div');
    const time = getTimeString();

    if (type === 'user') {
        entry.className = 'thread-entry user-entry';
        entry.innerHTML = `<div class="entry-meta"><div class="entry-icon"><i class="fas fa-user"></i></div><span>Field Note</span><span class="entry-time">${time}</span></div><div class="entry-body">"${content}"</div>`;
        conversationHistory.push({ role: 'user', text: content });
    } else if (type === 'ai') {
        entry.className = 'thread-entry ai-entry';
        entry.innerHTML = `<div class="entry-meta"><div class="entry-icon">AI</div><span>FoliageCare AI</span><span class="entry-time">${time}</span></div><div class="entry-body">${content}</div>${extraHTML}`;
        conversationHistory.push({ role: 'ai', text: content });
    } else if (type === 'diagnosis') {
        entry.className = 'thread-entry ai-entry';
        entry.innerHTML = `<div class="entry-meta"><div class="entry-icon">AI</div><span>Diagnosis Report</span><span class="entry-time">${time}</span></div><div class="entry-body">${content}</div>${extraHTML}`;
        conversationHistory.push({ role: 'ai', text: content });
    } else if (type === 'warning') {
        entry.className = 'thread-entry warning-entry';
        entry.innerHTML = `<div class="entry-meta"><div class="entry-icon"><i class="fas fa-exclamation-triangle"></i></div><span>Validation Warning</span><span class="entry-time">${time}</span></div><div class="entry-body">${content}</div>`;
    }

    threadEntries.appendChild(entry);
    threadEntries.scrollTop = threadEntries.scrollHeight;
    return entry;
}

function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    threadEntries.appendChild(indicator);
    threadEntries.scrollTop = threadEntries.scrollHeight;
    return indicator;
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*)/gm, '<h4 style="margin:10px 0 4px;font-size:13px;">$1</h4>')
        .replace(/^## (.*)/gm, '<h3 style="margin:12px 0 6px;font-size:14px;">$1</h3>')
        .replace(/^# (.*)/gm, '<h2 style="margin:14px 0 6px;font-size:15px;">$1</h2>')
        .replace(/^- (.*)/gm, '<li style="margin:3px 0;">$1</li>')
        .replace(/(<li.*<\/li>)/s, '<ul style="padding-left:18px;margin:8px 0;">$1</ul>')
        .replace(/\n/g, '<br>');
}

// ═══════════ FIREBASE SAVE ═══════════

async function saveScanToHistory(diseaseResult, confidenceVal) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return;
    try {
        const user = window.firebaseAuth.currentUser;
        const db = window.db;
        const confidenceStr = (typeof confidenceVal === 'number') ? (confidenceVal * 100).toFixed(2) + '%' : confidenceVal;

        await window.addDoc(window.collection(db, 'scans'), {
            userId: user.uid, plantName: detectedPlantName || 'Plant Scan',
            disease: diseaseResult, confidence: confidenceStr, timestamp: window.serverTimestamp(),
            icon: diseaseResult.toLowerCase().includes('healthy') ? 'fas fa-seedling' : 'fas fa-exclamation-triangle',
        });

        if (userCoordinates) {
            const confNum = (typeof confidenceVal === 'number') ? confidenceVal : parseFloat(confidenceVal) / 100;
            await window.addDoc(window.collection(db, 'community_scans'), {
                disease: diseaseResult, confidence: confNum, latitude: userCoordinates.lat,
                longitude: userCoordinates.lng, timestamp: window.serverTimestamp(),
            });
            console.log('🗺️ Community scan contributed.');
        }
        console.log('✅ Scan saved to history.');
    } catch (error) {
        console.error('❌ Error saving scan:', error);
    }
}

// ═══════════ FILE UPLOAD LISTENER ═══════════

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
        setStep(1);
        getUserLocation();
        if (window.toast) window.toast.success('Image loaded — ready to analyze!');
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            const prompt = document.getElementById('drop-zone-prompt');
            const preview = document.getElementById('drop-zone-preview');
            if (prompt) prompt.style.display = 'none';
            if (preview) preview.style.display = 'flex';
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
});


// ═══════════ MAIN ANALYSIS — MODULE 1 (/predict) ═══════════

analyzeButton.addEventListener('click', async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) { if (window.toast) window.toast.warning('Please upload an image first.'); return; }

    const loc = locationInput ? locationInput.value.trim() : '';
    const ctx = contextInput ? contextInput.value.trim() : '';
    const userName = getUserName();
    const userType = getUserType();
    const fieldNote = fieldNoteInput ? fieldNoteInput.value.trim() : '';

    if (resultsEmpty) resultsEmpty.style.display = 'none';
    if (threadContainer) threadContainer.style.display = 'flex';
    threadEntries.innerHTML = '';
    conversationHistory = [];
    detectedDiseaseName = '';
    detectedPlantName = '';
    lastDiagnosisResult = null;
    if (unifiedSection) unifiedSection.style.display = 'none';
    if (followupBar) followupBar.style.display = 'none';

    if (fieldNote) addThreadEntry('user', fieldNote);
    addTypingIndicator();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    formData.append('context', fieldNote || ctx);
    if (userCoordinates) {
        formData.append('latitude', userCoordinates.lat);
        formData.append('longitude', userCoordinates.lng);
        formData.append('location', 'GPS Coordinates');
    } else if (loc) {
        formData.append('location', loc);
    }

    setStep(2);
    const originalBtnHTML = analyzeButton.innerHTML;
    analyzeButton.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;"></div> Analyzing…';
    analyzeButton.disabled = true;

    try {
        const response = await fetch('http://localhost:8000/predict', { method: 'POST', body: formData });
        removeTypingIndicator();

        if (!response.ok) {
            addThreadEntry('warning', '❌ Prediction failed. The server returned an error.');
            setStep(1);
            return;
        }

        const result = await response.json();
        console.log('🌟 v2.1 result:', result);

        if (result.error) {
            removeTypingIndicator();

            // NEW LOGIC: Try to salvage data if raw_response exists and contains at least the plant name
            if (result.raw_response && result.raw_response.includes('"plant"')) {
                const partialData = salvagePartialJSON(result.raw_response);

                addThreadEntry('warning', '⚠️ The network connection interrupted the full report, but we salvaged the core diagnosis.');
                if (window.toast) window.toast.warning('Partial data recovered.');

                // Override the result with our salvaged data to let the UI continue
                Object.assign(result, partialData);
                delete result.error; // Clear the error so the script continues to the UI render
            } else {
                // OLD LOGIC: Failsafe if it's completely unreadable
                let errTxt = result.error + (result.detail ? " | " + result.detail : "");
                addThreadEntry("warning", "❌ API Error: " + errTxt);
                if (result.raw_response) {
                    addThreadEntry("user", "Raw response: " + result.raw_response.substring(0, 250) + "...");
                }
                setStep(1);
                if (window.toast) window.toast.error("API Error: " + result.error);
                return;
            }
        }

        if (result.is_invalid_image) {
            addThreadEntry('warning', result.message || '⚠️ This doesn\'t appear to be a plant leaf. Please upload a clear photo of a plant leaf.');
            setStep(1);
            if (window.toast) window.toast.warning('Please upload a plant leaf image.');
            return;
        }

        const diagnosis = result.diagnosis || {};
        const evidence = result.visual_evidence || {};
        const trustSignals = result.trust_signals || {};
        const actionPlan = result.action_plan || {};

        const diseaseName = diagnosis.disease || 'Unknown';
        const plantName = diagnosis.plant || '';
        const plantHindi = diagnosis.plant_hindi || '';
        const severity = diagnosis.severity || 'mild';
        const confidence = diagnosis.confidence || 0;
        const confidencePct = (confidence * 100);

        detectedDiseaseName = diseaseName;
        detectedPlantName = plantName;
        lastDiagnosisResult = result;

        setStep(3);

        const plantLabel = plantHindi
            ? `${plantName} <span style="color:var(--text-muted,#888);font-weight:400;">(${plantHindi})</span>`
            : plantName;

        const diagHeaderHTML = `
            <strong>&#127807; ${plantLabel}</strong>${buildSeverityBadge(severity)}<br>
            <span style="font-size:13px;color:var(--text-secondary,#555);margin-top:4px;display:block;">${diseaseName}</span>
        `;

        const evidenceHTML = evidence.description
            ? `<div style="border-left:3px solid #5C8A2E;padding:8px 12px;margin:10px 0;font-size:13px;color:var(--text-secondary,#555);background:var(--bg-surface,#F8F4EC);border-radius:0 8px 8px 0;">${evidence.description}</div>`
            : '';

        const actionPlanHTML = buildActionPlanHTML(actionPlan);
        const trustHTML = buildTrustSignalsHTML(trustSignals);

        const visualsHTML = `
            <div class="diagnosis-visuals">
                <div class="diag-left">
                    <div class="confidence-gauge" id="thread-gauge">
                        <svg class="gauge-svg" viewBox="0 0 120 120">
                            <circle class="gauge-track" cx="60" cy="60" r="52"/>
                            <circle class="gauge-fill"  cx="60" cy="60" r="52"/>
                        </svg>
                        <div class="gauge-center">
                            <span class="gauge-value">0%</span>
                            <span class="gauge-label">Confidence</span>
                        </div>
                    </div>
                    <div class="leaf-overlay-wrapper" style="margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid var(--border-card,#e0e0e0);position:relative;">
                        <img id="overlay-leaf-img" src="${previewImage.src}" alt="Leaf with AI regions" style="width:100%;display:block;border-radius:12px;">
                    </div>
                </div>
                <div class="diagnosis-report">
                    ${evidenceHTML}
                    ${actionPlanHTML}
                    ${trustHTML}
                </div>
            </div>
        `;

        addThreadEntry('diagnosis', diagHeaderHTML, visualsHTML);

        const threadGauge = document.getElementById('thread-gauge');
        if (threadGauge) animateGauge(threadGauge, parseFloat(confidencePct.toFixed(1)));

        const overlayLeaf = document.getElementById('overlay-leaf-img');
        if (overlayLeaf && evidence.affected_regions && evidence.affected_regions.length) {
            drawRegionOverlay(overlayLeaf, evidence.affected_regions);
        }

        saveScanToHistory(diseaseName, confidence);

        if (unifiedSection) unifiedSection.style.display = 'block';
        if (followupBar) followupBar.style.display = 'flex';

        if (window.toast) window.toast.success(`Analysis complete: ${diseaseName}`);

    } catch (error) {
        console.error('❌ Error:', error);
        removeTypingIndicator();
        addThreadEntry('warning', '❌ Server error. Is main.py running?');
        setStep(1);
    } finally {
        analyzeButton.innerHTML = originalBtnHTML;
        analyzeButton.disabled = false;
    }
});

// ═══════════ FOLLOW-UP — MODULE 4 (/followup) ═══════════

async function sendFollowUp() {
    const question = followupInput.value.trim();
    if (!question || !detectedDiseaseName) return;

    const userName = getUserName();
    const userType = getUserType();
    followupInput.value = '';

    addThreadEntry('user', question);
    addTypingIndicator();
    followupSend.disabled = true;

    try {
        const response = await fetch('http://localhost:8000/followup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question, disease: detectedDiseaseName,
                conversation_history: conversationHistory,
                user_name: userName, user_type: userType,
                latitude: userCoordinates ? userCoordinates.lat : null,
                longitude: userCoordinates ? userCoordinates.lng : null,
            }),
        });
        removeTypingIndicator();
        if (response.ok) {
            const data = await response.json();
            addThreadEntry('ai', formatMarkdown(data.reply));
        } else {
            addThreadEntry('warning', 'Failed to get a response. Please try again.');
        }
    } catch (e) {
        console.error(e);
        removeTypingIndicator();
        addThreadEntry('warning', 'Connection error. Is the server running?');
    } finally {
        followupSend.disabled = false;
    }
}

if (followupSend) followupSend.addEventListener('click', sendFollowUp);
if (followupInput) followupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFollowUp(); });

// ── Suggested follow-up chips ──
function injectSuggestedQuestions() {
    if (!detectedDiseaseName) return;
    const questions = [
        'How do I apply the neem oil remedy?',
        'Is this safe around children and pets?',
        'How long until my plant recovers?',
        'Will this spread to other plants?',
    ];
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px;';
    questions.forEach(q => {
        const chip = document.createElement('button');
        chip.textContent = q;
        chip.style.cssText = 'background:transparent;border:1px solid #5C8A2E;color:#2D5016;border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;';
        chip.addEventListener('click', () => { followupInput.value = q; sendFollowUp(); });
        wrapper.appendChild(chip);
    });
    threadEntries.appendChild(wrapper);
    threadEntries.scrollTop = threadEntries.scrollHeight;
}

// ═══════════ SIMULATION — MODULE 2 (/simulate) ═══════════

simulateBtn.addEventListener('click', async () => {
    if (!detectedDiseaseName) { if (window.toast) window.toast.warning('Please analyze an image first!'); return; }

    const file = fileInput.files[0];
    const ctx = contextInput ? contextInput.value : '';
    const userName = getUserName();
    const userType = getUserType();

    simulateBtn.disabled = true;
    simulateBtn.innerText = 'Simulating...';
    if (globalLoader) globalLoader.style.display = 'block';
    if (futureImg) futureImg.style.display = 'none';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('disease_name', detectedDiseaseName);
    formData.append('context', ctx);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    if (userCoordinates) { formData.append('latitude', userCoordinates.lat); formData.append('longitude', userCoordinates.lng); }

    try {
        const response = await fetch('http://localhost:8000/simulate', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.future_image) {
            if (futureImg) { futureImg.src = 'data:image/jpeg;base64,' + data.future_image; futureImg.style.display = 'block'; }

            const promptNote = data.prompt_used
                ? `<div style="font-size:11px;color:var(--text-muted,#888);margin-top:8px;font-style:italic;"><strong>Simulation factors:</strong> ${data.prompt_used}</div>`
                : '';

            addThreadEntry('ai',
                '<strong>🔬 7-day progression simulation</strong><br>Based on your conditions, here is the projected visual if left untreated:',
                `<div style="margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid var(--border-card,#e0e0e0);"><img src="data:image/jpeg;base64,${data.future_image}" style="width:100%;display:block;" alt="Simulation"></div>
                 <div style="margin-top:8px;font-size:12px;color:#C0392B;font-weight:500;">⚠️ Act now to prevent this — see your care plan below.</div>${promptNote}`
            );
            if (window.toast) window.toast.success('Simulation generated!');
        } else {
            if (window.toast) window.toast.error('Simulation failed: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        if (window.toast) window.toast.error('Error connecting to server.');
    } finally {
        simulateBtn.disabled = false;
        simulateBtn.innerText = 'Simulate Visuals';
        if (globalLoader) globalLoader.style.display = 'none';
    }
});

// ═══════════ EXPERT PLAN — MODULE 3 (/get_expert_plan) ═══════════

planBtn.addEventListener('click', async () => {
    if (!detectedDiseaseName) return;

    const file = fileInput.files[0];
    const loc = locationInput ? (locationInput.value || 'General Region') : 'General Region';
    const ctx = contextInput ? (contextInput.value || '') : '';
    const userName = getUserName();
    const userType = getUserType();

    planBtn.disabled = true;
    planBtn.innerText = 'Consulting...';
    if (globalLoader) globalLoader.style.display = 'block';
    if (expertResult) expertResult.style.display = 'none';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('disease', detectedDiseaseName);
    formData.append('location', loc);
    formData.append('context', ctx);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    if (userCoordinates) { formData.append('latitude', userCoordinates.lat); formData.append('longitude', userCoordinates.lng); }

    try {
        const response = await fetch('http://localhost:8000/get_expert_plan', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.plan) {
            const html = formatMarkdown(data.plan);
            if (expertResult) { expertResult.innerHTML = html; expertResult.style.display = 'block'; }
            addThreadEntry('ai', '<strong>🧑‍⚕️ Expert care plan</strong><br>' + html);
            if (window.toast) window.toast.success('Expert plan generated!');
        } else {
            if (window.toast) window.toast.error('Expert plan failed: ' + (data.error || 'Unknown'));
        }
    } catch (e) {
        console.error(e);
        if (window.toast) window.toast.error('Error connecting to AI expert.');
    } finally {
        planBtn.disabled = false;
        planBtn.innerText = 'Generate Plan';
        if (globalLoader) globalLoader.style.display = 'none';
    }
});
