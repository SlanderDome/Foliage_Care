// ═══════════════════════════════════════════════
//  FOLIAGE CARE: CONSULTATION THREAD ENGINE
//  Handles upload, diagnosis, and follow-up flow
// ═══════════════════════════════════════════════

// --- DOM Elements ---
const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const previewImage = document.getElementById("preview-image");
const resultsEmpty = document.getElementById("results-empty");
const threadContainer = document.getElementById("thread-container");
const threadEntries = document.getElementById("thread-entries");
const fieldNoteInput = document.getElementById("field-note-input");

// Stepper elements
const stepperSteps = document.querySelectorAll('.stepper-step');
const stepperLines = document.querySelectorAll('.stepper-line');

// Confidence gauge elements
const confidenceGauge = document.getElementById("confidence-gauge");
const gaugeFill = document.getElementById("gauge-fill");
const gaugeValue = document.getElementById("gauge-value");

// Unified Section Elements
const unifiedSection = document.getElementById("unified-section");
const locationInput = document.getElementById("user-location");
const contextInput = document.getElementById("user-context");
const globalLoader = document.getElementById("global-loader");

// Simulation Elements
const simulateBtn = document.getElementById("simulate-btn");
const futureImg = document.getElementById("future-image");

// Expert Plan Elements
const planBtn = document.getElementById("get-plan-btn");
const expertResult = document.getElementById("expert-result");

// Follow-Up Elements
const followupBar = document.getElementById("followup-bar");
const followupInput = document.getElementById("followup-input");
const followupSend = document.getElementById("followup-send");

// ═══════════ GLOBAL STATE ═══════════
let detectedDiseaseName = "";
let userCoordinates = null;
let conversationHistory = []; // Tracks thread for Gemini context

// ═══════════ HELPERS ═══════════

function getUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            console.log("📍 Location Captured:", userCoordinates);
            const locInput = document.getElementById("user-location");
            if (locInput && !locInput.value) {
                locInput.value = `${userCoordinates.lat.toFixed(4)}, ${userCoordinates.lng.toFixed(4)}`;
            }
        },
        (err) => { console.warn("⚠️ Location access denied."); },
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

// --- Stepper Control ---
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

// --- Confidence Gauge Animation ---
function animateGauge(gaugeContainer, percent) {
    gaugeContainer.style.display = 'flex';
    const fill = gaugeContainer.querySelector('.gauge-fill');
    const value = gaugeContainer.querySelector('.gauge-value');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percent / 100) * circumference;

    let color = '#7cb342';
    if (percent < 50) color = '#c0543a';
    else if (percent < 75) color = '#c9a84c';

    fill.style.stroke = color;
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
        fill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)';
        fill.style.strokeDashoffset = offset;
    });

    let current = 0;
    const duration = 1500;
    const start = performance.now();
    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        current = (eased * percent).toFixed(1);
        value.textContent = current + '%';
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ═══════════ THREAD ENTRY SYSTEM ═══════════

function addThreadEntry(type, content, extraHTML = '') {
    const entry = document.createElement('div');
    const time = getTimeString();

    if (type === 'user') {
        entry.className = 'thread-entry user-entry';
        entry.innerHTML = `
            <div class="entry-meta">
                <div class="entry-icon"><i class="fas fa-user"></i></div>
                <span>Field Note</span>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-body">"${content}"</div>
        `;
        conversationHistory.push({ role: 'user', text: content });
    } else if (type === 'ai') {
        entry.className = 'thread-entry ai-entry';
        entry.innerHTML = `
            <div class="entry-meta">
                <div class="entry-icon">AI</div>
                <span>FoliageCare AI</span>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-body">${content}</div>
            ${extraHTML}
        `;
        conversationHistory.push({ role: 'ai', text: content });
    } else if (type === 'diagnosis') {
        entry.className = 'thread-entry ai-entry';
        entry.innerHTML = `
            <div class="entry-meta">
                <div class="entry-icon">AI</div>
                <span>Diagnosis Report</span>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-body">${content}</div>
            ${extraHTML}
        `;
        conversationHistory.push({ role: 'ai', text: content });
    } else if (type === 'warning') {
        entry.className = 'thread-entry warning-entry';
        entry.innerHTML = `
            <div class="entry-meta">
                <div class="entry-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <span>Validation Warning</span>
                <span class="entry-time">${time}</span>
            </div>
            <div class="entry-body">${content}</div>
        `;
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
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// ═══════════ FIREBASE SAVE ═══════════

async function saveScanToHistory(diseaseResult, confidenceVal) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return;
    try {
        const user = window.firebaseAuth.currentUser;
        const db = window.db;
        const confidenceStr = (typeof confidenceVal === 'number')
            ? (confidenceVal * 100).toFixed(2) + "%" : confidenceVal;

        await window.addDoc(window.collection(db, "scans"), {
            userId: user.uid,
            plantName: "Plant Scan",
            disease: diseaseResult,
            confidence: confidenceStr,
            timestamp: window.serverTimestamp(),
            icon: diseaseResult.toLowerCase().includes("healthy") ? "fas fa-seedling" : "fas fa-exclamation-triangle"
        });
        console.log("✅ Scan saved to history!");
    } catch (error) {
        console.error("❌ Error saving scan:", error);
    }
}

// ═══════════ FILE UPLOAD LISTENER ═══════════

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
        setStep(1);
        getUserLocation();
        if (window.toast) window.toast.success('Image loaded — ready to analyze!');

        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            document.getElementById('drop-zone-prompt').style.display = 'none';
            document.getElementById('drop-zone-preview').style.display = 'flex';
        }
        reader.readAsDataURL(fileInput.files[0]);
    }
});

// ═══════════ MAIN ANALYSIS (Module 1) ═══════════

analyzeButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        if (window.toast) window.toast.warning('Please upload an image first.');
        return;
    }

    const loc = locationInput ? locationInput.value : "";
    const ctx = contextInput ? contextInput.value : "";
    const userName = getUserName();
    const fieldNote = fieldNoteInput ? fieldNoteInput.value.trim() : "";

    // Show thread, hide empty
    if (resultsEmpty) resultsEmpty.style.display = 'none';
    if (threadContainer) threadContainer.style.display = 'flex';

    // Clear previous thread
    threadEntries.innerHTML = '';
    conversationHistory = [];
    if (unifiedSection) unifiedSection.style.display = "none";
    if (followupBar) followupBar.style.display = "none";

    // If user typed a field note, add it as the first entry
    if (fieldNote) {
        addThreadEntry('user', fieldNote);
    }

    // Show typing indicator
    addTypingIndicator();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("context", fieldNote || ctx);
    formData.append("user_name", userName);

    if (userCoordinates) {
        formData.append("latitude", userCoordinates.lat);
        formData.append("longitude", userCoordinates.lng);
        formData.append("location", "GPS Coordinates");
    } else {
        formData.append("location", loc);
    }

    setStep(2);
    const originalBtnHTML = analyzeButton.innerHTML;
    analyzeButton.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;"></div> Analyzing…';
    analyzeButton.disabled = true;

    try {
        console.log("🌿 Sending to Backend...");
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            body: formData
        });

        removeTypingIndicator();

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result:", result);

            // Check if it's a non-plant image warning
            if (result.is_invalid_image) {
                addThreadEntry('warning', result.prevention_measures || "⚠️ This doesn't appear to be a plant leaf image. Please upload a clear photo of a plant leaf for accurate diagnosis.");
                setStep(1);
                if (window.toast) window.toast.warning('Please upload a plant leaf image.');
                return;
            }

            setStep(3);
            const confidencePercent = (result.confidence * 100).toFixed(2);

            // Build the diagnosis entry with inline visuals
            const diagText = `<strong>🌿 ${result.class}</strong> detected with <strong>${confidencePercent}%</strong> confidence.`;
            const reportText = result.prevention_measures || "";

            const visualsHTML = `
                <div class="diagnosis-visuals">
                    <div class="diag-left">
                        <div class="confidence-gauge" id="thread-gauge">
                            <svg class="gauge-svg" viewBox="0 0 120 120">
                                <circle class="gauge-track" cx="60" cy="60" r="52" />
                                <circle class="gauge-fill" cx="60" cy="60" r="52" />
                            </svg>
                            <div class="gauge-center">
                                <span class="gauge-value">0%</span>
                                <span class="gauge-label">Confidence</span>
                            </div>
                        </div>
                        ${result.explanation_image ? `
                        <div class="gradcam-wrapper" style="border-radius:10px;overflow:hidden;">
                            <img src="data:image/jpeg;base64,${result.explanation_image}" alt="AI Heatmap" style="width:100%;display:block;" id="gradcam-image">
                        </div>` : ''}
                    </div>
                    <div class="diagnosis-report">${formatMarkdown(reportText)}</div>
                </div>
            `;

            addThreadEntry('diagnosis', diagText, visualsHTML);

            // Animate the gauge inside the thread entry
            const threadGauge = document.getElementById('thread-gauge');
            if (threadGauge) animateGauge(threadGauge, parseFloat(confidencePercent));

            // Save state
            detectedDiseaseName = result.class;
            saveScanToHistory(result.class, result.confidence);

            // Show unified section and follow-up bar
            if (unifiedSection) unifiedSection.style.display = "block";
            if (followupBar) followupBar.style.display = "flex";

            if (window.toast) window.toast.success(`Analysis Complete: ${result.class}`);
        } else {
            removeTypingIndicator();
            addThreadEntry('warning', '❌ Prediction failed. The server returned an error.');
            setStep(1);
        }
    } catch (error) {
        console.error("❌ Error:", error);
        removeTypingIndicator();
        addThreadEntry('warning', '❌ Server Error. Is main.py running?');
        setStep(1);
    } finally {
        analyzeButton.innerHTML = originalBtnHTML;
        analyzeButton.disabled = false;
    }
});

// ═══════════ FOLLOW-UP HANDLER ═══════════

async function sendFollowUp() {
    const question = followupInput.value.trim();
    if (!question || !detectedDiseaseName) return;

    const userName = getUserName();
    followupInput.value = '';

    // Add user entry
    addThreadEntry('user', question);
    addTypingIndicator();

    followupSend.disabled = true;

    try {
        const response = await fetch("http://127.0.0.1:8000/followup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: question,
                disease: detectedDiseaseName,
                conversation_history: conversationHistory,
                user_name: userName,
                latitude: userCoordinates ? userCoordinates.lat : null,
                longitude: userCoordinates ? userCoordinates.lng : null
            })
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

if (followupSend) {
    followupSend.addEventListener("click", sendFollowUp);
}

if (followupInput) {
    followupInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendFollowUp();
    });
}

// ═══════════ VISUAL SIMULATION (Module 2) ═══════════

simulateBtn.addEventListener("click", async () => {
    if (!detectedDiseaseName) {
        if (window.toast) window.toast.warning('Please analyze an image first!');
        return;
    }

    const file = fileInput.files[0];
    const context = contextInput.value;
    const userName = getUserName();

    simulateBtn.disabled = true;
    simulateBtn.innerText = "Simulating...";
    globalLoader.style.display = "block";
    futureImg.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease_name", detectedDiseaseName);
    formData.append("context", context);
    formData.append("user_name", userName);

    if (userCoordinates) {
        formData.append("latitude", userCoordinates.lat);
        formData.append("longitude", userCoordinates.lng);
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/simulate", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.future_image) {
            futureImg.src = "data:image/jpeg;base64," + data.future_image;
            futureImg.style.display = "block";

            // Also add to thread
            addThreadEntry('ai', '<strong>🔬 Future Progression Simulation</strong><br>Here is what the leaf may look like after 5 days of untreated progression:',
                `<div style="margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid var(--border-card);">
                    <img src="data:image/jpeg;base64,${data.future_image}" style="width:100%;display:block;" alt="Simulation">
                </div>`
            );

            if (window.toast) window.toast.success('Visual simulation generated!');
        } else {
            if (window.toast) window.toast.error("Simulation failed: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        if (window.toast) window.toast.error('Error connecting to server.');
    } finally {
        simulateBtn.disabled = false;
        simulateBtn.innerText = "Simulate Visuals";
        globalLoader.style.display = "none";
    }
});

// ═══════════ EXPERT CURE PLAN (Module 3) ═══════════

planBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    // Use defaults if empty — don't block the user
    const loc = locationInput.value || "General Region";
    const ctx = contextInput.value || "General Context";
    const userName = getUserName();

    if (!detectedDiseaseName) return;

    planBtn.disabled = true;
    planBtn.innerText = "Consulting...";
    globalLoader.style.display = "block";
    expertResult.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease", detectedDiseaseName);
    formData.append("location", loc);
    formData.append("context", ctx);
    formData.append("user_name", userName);

    if (userCoordinates) {
        formData.append("latitude", userCoordinates.lat);
        formData.append("longitude", userCoordinates.lng);
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/get_expert_plan", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.plan) {
            let html = formatMarkdown(data.plan);
            expertResult.innerHTML = html;
            expertResult.style.display = "block";

            // Also add to thread
            addThreadEntry('ai', '<strong>🧑‍⚕️ Expert Cure Plan</strong><br>' + html);

            if (window.toast) window.toast.success('Expert plan generated!');
        } else {
            if (window.toast) window.toast.error("Expert failed: " + (data.error || "Unknown"));
        }
    } catch (e) {
        console.error(e);
        if (window.toast) window.toast.error('Error connecting to AI Expert.');
    } finally {
        planBtn.disabled = false;
        planBtn.innerText = "Generate Plan";
        globalLoader.style.display = "none";
    }
});
