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
const globalLoader = document.getElementById("global-loader");

// Simulation
const simulateBtn = document.getElementById("simulate-btn");

// Expert plan
const planBtn = document.getElementById("get-plan-btn");

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
let currentLocationWeather = "";

// ═══════════ HELPERS ═══════════

function getUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async (pos) => { // <-- Make sure to add 'async' here
            userCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            console.log("📍 Location captured:", userCoordinates);
            
            const locInput = document.getElementById("user-location");
            if (locInput && !locInput.value) {
                locInput.value = `${userCoordinates.lat.toFixed(4)}, ${userCoordinates.lng.toFixed(4)}`;
            }

            // NEW: Fetch the weather immediately after getting coordinates
            const weather = await getLiveWeather(userCoordinates.lat, userCoordinates.lng);
            if (weather) {
                currentLocationWeather = weather;
            }
        },
        () => { console.warn("⚠️ Location access denied."); },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

async function getWeatherTrend(lat, lng) {
    try {
        // Fetch daily max temps and rain for the past 7 days and forecast for next 3 days
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_sum&past_days=7&forecast_days=3&timezone=auto`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Weather trend fetch failed");
        
        const data = await response.json();
        
        // Calculate the trend summary
        const pastTemps = data.daily.temperature_2m_max.slice(0, 7);
        const pastRain = data.daily.precipitation_sum.slice(0, 7);
        
        const avgTemp = (pastTemps.reduce((a, b) => a + b, 0) / 7).toFixed(1);
        const totalRain = pastRain.reduce((a, b) => a + b, 0).toFixed(1);
        
        // Create a human-readable narrative for Gemini
        const trendNarrative = `Over the last 7 days, this location experienced an average daily high of ${avgTemp}°C with a total rainfall of ${totalRain}mm.`;
        
        console.log("🌦️ Weather Trend Captured:", trendNarrative);
        return trendNarrative;
        
    } catch (error) {
        console.warn("⚠️ Could not fetch weather trend:", error);
        return null;
    }
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

function setThreadActionState(button, label, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.dataset.defaultLabel = button.dataset.defaultLabel || button.innerHTML;
    button.innerHTML = isLoading ? label : button.dataset.defaultLabel;
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
        none: { bg: 'rgba(124, 179, 66, 0.1)', color: 'var(--accent)', border: 'rgba(124, 179, 66, 0.2)', label: 'Healthy ✓' },
        mild: { bg: 'rgba(201, 168, 76, 0.1)', color: 'var(--gold)', border: 'rgba(201, 168, 76, 0.2)', label: 'Mild issue' },
        moderate: { bg: 'rgba(192, 84, 58, 0.1)', color: 'var(--ember)', border: 'rgba(192, 84, 58, 0.2)', label: 'Moderate' },
        severe: { bg: 'rgba(192, 57, 43, 0.15)', color: '#e74c3c', border: 'rgba(231, 76, 60, 0.3)', label: 'Severe — act now' },
    };
    const s = map[severity] || map['mild'];
    return `<span class="severity-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.border};">${s.label}</span>`;
}

// --- Action plan renderer ---
function buildActionPlanHTML(actionPlan) {
    if (!actionPlan) return '';
    const steps = [
        { icon: '<i class="fas fa-bolt"></i>', title: 'Do this today', body: actionPlan.immediate_action, theme: 'danger' },
        { icon: '<i class="fas fa-leaf"></i>', title: 'Desi / organic treatment', body: actionPlan.desi_remedy, theme: 'success' },
        {
            icon: '<i class="fas fa-vial"></i>', title: 'If it gets worse',
            body: actionPlan.organic_option
                ? actionPlan.organic_option + (actionPlan.chemical_option ? '<br><br>' + actionPlan.chemical_option : '')
                : actionPlan.chemical_option,
            theme: 'warning'
        },
    ];

    const stepsHTML = steps.filter(s => s.body).map(s => `
        <div class="action-card theme-${s.theme}">
            <div class="action-card-header">
                <span class="action-icon">${s.icon}</span>
                <span class="action-title">${s.title}</span>
            </div>
            <div class="action-card-body">${s.body}</div>
        </div>
    `).join('');

    const seasonTip = actionPlan.seasonal_tip
        ? `<div class="seasonal-tip">
             <span class="season-icon"><i class="fas fa-cloud-sun-rain"></i></span>
             <span class="season-text"><strong>Seasonal tip:</strong> ${actionPlan.seasonal_tip}</span>
           </div>`
        : '';

    return `<div class="action-plan-grid">${stepsHTML}</div>${seasonTip}`;
}

// --- Trust signals renderer ---
function buildTrustSignalsHTML(trustSignals) {
    if (!trustSignals) return '';
    const items = [
        { icon: '<i class="fas fa-check-circle"></i>', color: 'var(--accent-dim)', text: trustSignals.why_this_diagnosis },
        { icon: '<i class="fas fa-random"></i>', color: 'var(--text-muted)', text: trustSignals.alternative_diagnosis },
        { icon: '<i class="fas fa-info-circle"></i>', color: 'var(--gold-dim)', text: trustSignals.confidence_explanation },
    ].filter(i => i.text && i.text !== 'None');
    if (!items.length) return '';

    const rows = items.map(i => `
        <div class="trust-row">
            <span class="trust-icon" style="color:${i.color}">${i.icon}</span>
            <span class="trust-text">${i.text}</span>
        </div>
    `).join('');

    return `
        <details class="trust-panel">
            <summary class="trust-summary">Why we think this <i class="fas fa-chevron-down"></i></summary>
            <div class="trust-content">${rows}</div>
        </details>
    `;
}


// --- Region overlay (replaces Grad-CAM) ---
// ═══════════════════════════════════════════════
//  FOLIAGE CARE — REGION OVERLAY FIX
//  Drop these two blocks into up.js, replacing:
//  1. The drawRegionOverlay() function
//  2. The overlay rendering section inside analyzeButton click handler
// ═══════════════════════════════════════════════


// ─── REPLACE: drawRegionOverlay() function ────────────────────
// The old version used getElementById which fails because the
// element is injected via innerHTML and may not be in DOM yet.
// This version receives the element directly — no ID lookup.

function drawRegionOverlay(imgElement, regions) {
    if (!regions || !regions.length) {
        console.warn('⚠️ drawRegionOverlay: no regions to draw', regions);
        return;
    }

    function draw() {
        const W = imgElement.naturalWidth;
        const H = imgElement.naturalHeight;

        if (!W || !H) {
            console.warn('⚠️ drawRegionOverlay: image has no naturalWidth/Height yet', W, H);
            return;
        }

        console.log(`✅ Drawing ${regions.length} overlay regions on ${W}×${H} image`);

        // Make wrapper relative — required for absolute canvas positioning
        const wrapper = imgElement.parentElement;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = '100%';

        // Remove any stale canvas from a previous diagnosis
        const existing = wrapper.querySelector('.region-overlay-canvas');
        if (existing) existing.remove();

        // Create canvas matching the image's natural dimensions
        const canvas = document.createElement('canvas');
        canvas.className = 'region-overlay-canvas';
        canvas.width = W;
        canvas.height = H;

        // Stretch canvas visually over the image using CSS
        // (canvas pixel space = naturalWidth × naturalHeight,
        //  display space      = image rendered size)
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            border-radius: inherit;
        `;
        wrapper.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        // Draw each region with a staggered draw-in animation
        regions.forEach((region, idx) => {
            // Clamp coordinates — Gemini occasionally returns slightly > 1.0
            const x_pct = Math.min(Math.max(region.x_pct || 0, 0), 1);
            const y_pct = Math.min(Math.max(region.y_pct || 0, 0), 1);
            const w_pct = Math.min(Math.max(region.w_pct || 0, 0), 1 - x_pct);
            const h_pct = Math.min(Math.max(region.h_pct || 0, 0), 1 - y_pct);

            const x = x_pct * W;
            const y = y_pct * H;
            const w = w_pct * W;
            const h = h_pct * H;

            if (w < 2 || h < 2) {
                console.warn(`⚠️ Region ${idx} too small to draw:`, { x, y, w, h });
                return;
            }

            console.log(`📦 Region ${idx} "${region.label}": x=${x.toFixed(0)} y=${y.toFixed(0)} w=${w.toFixed(0)} h=${h.toFixed(0)}`);

            setTimeout(() => {
                const perimeter = 2 * (w + h);
                const duration = 600;
                const startTime = performance.now();

                function animateBox(now) {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const drawn = progress * perimeter;

                    // Clear just this box's area (+4px padding for label)
                    ctx.clearRect(x - 3, y - 24, w + 6, h + 27);

                    // Tinted fill
                    ctx.fillStyle = 'rgba(212, 160, 23, 0.10)';
                    ctx.fillRect(x, y, w, h);

                    // Animated stroke — draw partial perimeter
                    ctx.strokeStyle = '#D4A017';
                    ctx.lineWidth = Math.max(2, W / 200); // scale with image size
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.beginPath();

                    let rem = drawn;
                    // Top edge →
                    if (rem > 0) { const s = Math.min(rem, w); ctx.moveTo(x, y); ctx.lineTo(x + s, y); rem -= s; }
                    // Right edge ↓
                    if (rem > 0) { const s = Math.min(rem, h); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + s); rem -= s; }
                    // Bottom edge ←
                    if (rem > 0) { const s = Math.min(rem, w); ctx.moveTo(x + w, y + h); ctx.lineTo(x + w - s, y + h); rem -= s; }
                    // Left edge ↑
                    if (rem > 0) { const s = Math.min(rem, h); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h - s); }
                    ctx.stroke();

                    // Label — fades in with the box
                    if (region.label && progress > 0.1) {
                        const label = region.label;
                        const fontSize = Math.max(11, Math.round(W / 60));
                        ctx.font = `500 ${fontSize}px "DM Sans", sans-serif`;
                        const textW = ctx.measureText(label).width;
                        const padX = 6, padY = 4;
                        const boxW = textW + padX * 2;
                        const boxH = fontSize + padY * 2;
                        const labelX = x;
                        // Put label above box if space, else inside top
                        const labelY = y - boxH - 2 >= 0 ? y - boxH - 2 : y + 2;

                        ctx.globalAlpha = progress;
                        ctx.fillStyle = 'rgba(212, 160, 23, 0.92)';
                        // Rounded label background
                        const r = 3;
                        ctx.beginPath();
                        ctx.moveTo(labelX + r, labelY);
                        ctx.lineTo(labelX + boxW - r, labelY);
                        ctx.quadraticCurveTo(labelX + boxW, labelY, labelX + boxW, labelY + r);
                        ctx.lineTo(labelX + boxW, labelY + boxH - r);
                        ctx.quadraticCurveTo(labelX + boxW, labelY + boxH, labelX + boxW - r, labelY + boxH);
                        ctx.lineTo(labelX + r, labelY + boxH);
                        ctx.quadraticCurveTo(labelX, labelY + boxH, labelX, labelY + boxH - r);
                        ctx.lineTo(labelX, labelY + r);
                        ctx.quadraticCurveTo(labelX, labelY, labelX + r, labelY);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = '#FFFFFF';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(label, labelX + padX, labelY + boxH / 2);
                        ctx.globalAlpha = 1;
                    }

                    if (progress < 1) requestAnimationFrame(animateBox);
                }

                requestAnimationFrame(animateBox);
            }, idx * 200); // 200ms stagger between boxes
        });
    }

    // Key fix: use MutationObserver to wait until the image is in the DOM
    // AND has loaded its natural dimensions — whichever comes last
    if (imgElement.complete && imgElement.naturalWidth > 0) {
        // Already loaded — draw immediately
        draw();
    } else {
        // Not loaded yet — wait for load event
        imgElement.addEventListener('load', () => {
            console.log('🖼️ Image loaded, drawing overlay now');
            draw();
        }, { once: true });

        // Extra safety: if src is already set but load hasn't fired,
        // poll for naturalWidth for up to 3 seconds
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            if (imgElement.naturalWidth > 0) {
                clearInterval(poll);
                draw();
            } else if (attempts > 30) {
                clearInterval(poll);
                console.error('❌ drawRegionOverlay: image never loaded after 3s');
            }
        }, 100);
    }
}


// ─── REPLACE: overlay rendering block inside analyzeButton handler ────
// Find this block in your analyzeButton click handler:
//
//   const overlayLeaf = document.getElementById('overlay-leaf-img');
//   if (overlayLeaf && evidence.affected_regions ...) {
//       drawRegionOverlay(overlayLeaf, evidence.affected_regions);
//   }
//
// Replace it with this:

/*

    // ── Draw region overlay ──
    // Use a small timeout so the DOM has time to render the
    // thread entry HTML before we try to find the image element.
    // querySelector on threadEntries is safer than getElementById
    // because it searches within the thread container only.
    setTimeout(() => {
        const regions = evidence.affected_regions || [];

        if (!regions.length) {
            console.warn('⚠️ No affected_regions returned by Gemini — overlay skipped');
            return;
        }

        // Find the most recently added overlay image — last one in thread
        const allLeafImgs = threadEntries.querySelectorAll('.overlay-leaf-img');
        const overlayLeaf = allLeafImgs[allLeafImgs.length - 1];

        if (!overlayLeaf) {
            console.error('❌ Could not find .overlay-leaf-img in thread entries');
            return;
        }

        console.log('🎯 Found overlay target, regions:', regions);
        drawRegionOverlay(overlayLeaf, regions);
    }, 100); // 100ms — enough for innerHTML to render

*/


// ─── ALSO UPDATE: the visualsHTML string in analyzeButton handler ────
// Change id="overlay-leaf-img" to class="overlay-leaf-img"
// (class lets querySelector find the LAST one, id always finds the FIRST)
//
// Find this line in visualsHTML:
//   <img id="overlay-leaf-img"
//
// Change to:
//   <img class="overlay-leaf-img"
//
// Full corrected img tag:
/*

    <img class="overlay-leaf-img"
         src="${previewImage.src}"
         alt="Leaf with AI regions"
         style="width:100%;display:block;border-radius:12px;">

*/

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

async function saveScanToHistory(diseaseResult, confidenceVal, severityVal) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return;
    try {
        const user = window.firebaseAuth.currentUser;
        const db = window.db;
        const confidenceStr = (typeof confidenceVal === 'number') ? (confidenceVal * 100).toFixed(2) + '%' : confidenceVal;

        await window.addDoc(window.collection(db, 'scans'), {
            userId: user.uid, plantName: detectedPlantName || 'Plant Scan',
            disease: diseaseResult, confidence: confidenceStr, severity: severityVal || 'unknown',
            timestamp: window.serverTimestamp(),
            icon: diseaseResult.toLowerCase().includes('healthy') ? 'fas fa-seedling' : 'fas fa-exclamation-triangle',
        });

        if (userCoordinates) {
            const confNum = (typeof confidenceVal === 'number') ? confidenceVal : parseFloat(confidenceVal) / 100;
            await window.addDoc(window.collection(db, 'community_scans'), {
                disease: diseaseResult, confidence: confNum, latitude: userCoordinates.lat,
                longitude: userCoordinates.lng, severity: severityVal || 'unknown',
                timestamp: window.serverTimestamp(),
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
    formData.append('file',      file);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    formData.append('context',   fieldNote || ctx);
    // In your analyzeButton event listener:
if (typeof currentLocationWeather !== 'undefined' && currentLocationWeather) {
    formData.append('weather_trend', currentLocationWeather);
}
    if (userCoordinates) {
        formData.append('latitude', userCoordinates.lat);
        formData.append('longitude', userCoordinates.lng);
        formData.append('location', 'GPS Coordinates');
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
            <strong><i class="fas fa-clipboard-check" style="color:var(--accent);margin-right:6px;"></i> Diagnosis Complete for ${plantLabel}</strong>
        `;

        const evidenceHTML = evidence.description
            ? `<div class="evidence-box">
                 <i class="fas fa-microscope" style="color:var(--accent);margin-right:8px;"></i>
                 <p>${evidence.description}</p>
               </div>`
            : '';

        const actionPlanHTML = buildActionPlanHTML(actionPlan);
        const trustHTML = buildTrustSignalsHTML(trustSignals);

        const visualsHTML = `
            <div class="premium-diagnosis-card">
                
                <div class="diag-hero-split">
                    <!-- Left: Leaf Image with floating gauge -->
                    <div class="diag-visual-frame">
                        <div class="confidence-floating-badge" id="thread-gauge">
                            <svg class="gauge-svg" viewBox="0 0 120 120">
                                <circle class="gauge-track" cx="60" cy="60" r="52"/>
                                <circle class="gauge-fill"  cx="60" cy="60" r="52"/>
                            </svg>
                            <div class="gauge-center">
                                <span class="gauge-value">0%</span>
                                <span class="gauge-label">Confidence</span>
                            </div>
                        </div>
                        <img id="overlay-leaf-img" class="overlay-leaf-img" src="${previewImage.src}" alt="Leaf with AI regions">
                    </div>
                    
                    <!-- Right: Evidence & Result -->
                    <div class="diag-details-frame">
                        <div class="diag-rep-badge-row">
                            <div class="diag-rep-disease">${diseaseName}</div>
                            ${buildSeverityBadge(severity)}
                        </div>
                        ${evidenceHTML}
                    </div>
                </div>

                <div class="diag-action-section">
                    <h4 class="section-kicker">Recommended Plan</h4>
                    ${actionPlanHTML}
                </div>
                
                <div class="diag-trust-section">
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

        saveScanToHistory(diseaseName, confidence, severity);

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
    const noteContext = fieldNoteInput ? fieldNoteInput.value.trim() : '';
    const userName = getUserName();
    const userType = getUserType();

    setThreadActionState(simulateBtn, '<span class="thread-action-text"><strong>Simulating...</strong><small>Generating a forecast inside the thread.</small></span>', true);
    addTypingIndicator();
    if (globalLoader) globalLoader.style.display = 'block';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('disease_name', detectedDiseaseName);
    formData.append('context', noteContext);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    if (userCoordinates) { formData.append('latitude', userCoordinates.lat); formData.append('longitude', userCoordinates.lng); }

    try {
        setStep(4);
        const response = await fetch('http://localhost:8000/simulate', { method: 'POST', body: formData });
        const data = await response.json();
        removeTypingIndicator();

        if (data.future_image) {
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
            addThreadEntry('warning', 'Forecast generation failed. Please try again.');
            if (window.toast) window.toast.error('Simulation failed: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        removeTypingIndicator();
        addThreadEntry('warning', 'Connection error while generating the forecast.');
        if (window.toast) window.toast.error('Error connecting to server.');
    } finally {
        removeTypingIndicator();
        setThreadActionState(simulateBtn, '', false);
        if (globalLoader) globalLoader.style.display = 'none';
    }
});

// ═══════════ EXPERT PLAN — MODULE 3 (/get_expert_plan) ═══════════

planBtn.addEventListener('click', async () => {
    if (!detectedDiseaseName) return;

    const file = fileInput.files[0];
    const noteContext = fieldNoteInput ? fieldNoteInput.value.trim() : '';
    const userName = getUserName();
    const userType = getUserType();

    setThreadActionState(planBtn, '<span class="thread-action-text"><strong>Building plan...</strong><small>Adding a treatment plan to the thread.</small></span>', true);
    addTypingIndicator();
    if (globalLoader) globalLoader.style.display = 'block';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('disease', detectedDiseaseName);
    formData.append('location', userCoordinates ? 'GPS Coordinates' : 'General Region');
    formData.append('context', noteContext);
    formData.append('user_name', userName);
    formData.append('user_type', userType);
    if (userCoordinates) { formData.append('latitude', userCoordinates.lat); formData.append('longitude', userCoordinates.lng); }

    try {
        const response = await fetch('http://localhost:8000/get_expert_plan', { method: 'POST', body: formData });
        const data = await response.json();
        removeTypingIndicator();

        if (data.plan) {
            const html = formatMarkdown(data.plan);
            
            addThreadEntry('ai', '<strong>🧑‍⚕️ Expert care plan</strong><br>' + html);
            if (window.toast) window.toast.success('Expert plan generated!');
        } else {
            addThreadEntry('warning', 'Care plan generation failed. Please try again.');
            if (window.toast) window.toast.error('Expert plan failed: ' + (data.error || 'Unknown'));
        }
    } catch (e) {
        console.error(e);
        removeTypingIndicator();
        addThreadEntry('warning', 'Connection error while generating the care plan.');
        if (window.toast) window.toast.error('Error connecting to AI expert.');
    } finally {
        removeTypingIndicator();
        setThreadActionState(planBtn, '', false);
        if (globalLoader) globalLoader.style.display = 'none';
    }
});
