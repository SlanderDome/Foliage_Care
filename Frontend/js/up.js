// --- DOM Elements ---
const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const diseaseInfo = document.getElementById("disease-info");
const previewImage = document.getElementById("preview-image");
const resultsEmpty = document.getElementById("results-empty");
const aiReplyContent = document.getElementById("ai-reply-content"); // Hidden by default
const diseaseInfoGroup = document.getElementById("disease-info-group");
const visualResultDiv = document.getElementById("visual-result");
const gradCamImg = document.getElementById("gradcam-image");

// Stepper elements
const stepperSteps = document.querySelectorAll('.stepper-step');
const stepperLines = document.querySelectorAll('.stepper-line');

// Confidence gauge elements
const confidenceGauge = document.getElementById("confidence-gauge");
const gaugeFill = document.getElementById("gauge-fill");
const gaugeValue = document.getElementById("gauge-value");

// --- NEW UNIFIED SECTION ELEMENTS ---
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

// Global State
let detectedDiseaseName = "";


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
function animateGauge(percent) {
    confidenceGauge.style.display = 'flex';
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (percent / 100) * circumference;

    let color = '#7cb342'; // green
    if (percent < 50) color = '#c0543a'; // red
    else if (percent < 75) color = '#c9a84c'; // gold

    gaugeFill.style.stroke = color;
    gaugeFill.style.strokeDasharray = circumference;
    gaugeFill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
        gaugeFill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)';
        gaugeFill.style.strokeDashoffset = offset;
    });

    let current = 0;
    const target = percent;
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        current = (eased * target).toFixed(1);
        gaugeValue.textContent = current + '%';
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// --- Typing Effect for Textarea ---
function typeText(element, text, speed = 12) {
    return new Promise((resolve) => {
        element.value = '';
        let i = 0;
        function step() {
            if (i < text.length) {
                element.value += text[i];
                i++;
                element.scrollTop = element.scrollHeight;
                setTimeout(step, speed);
            } else {
                resolve();
            }
        }
        step();
    });
}

// --- Firebase Save ---
async function saveScanToHistory(diseaseResult, confidenceVal) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
        console.log("User not logged in. History not saved.");
        return;
    }

    try {
        const user = window.firebaseAuth.currentUser;
        const db = window.db;
        const confidenceStr = (typeof confidenceVal === 'number')
            ? (confidenceVal * 100).toFixed(2) + "%"
            : confidenceVal;

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

// --- File Upload Listener ---
fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
        setStep(1);
        if (window.toast) window.toast.success('Image loaded — ready to analyze!');

        // Preview the image
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            document.getElementById('drop-zone-prompt').style.display = 'none';
            document.getElementById('drop-zone-preview').style.display = 'flex';
        }
        reader.readAsDataURL(fileInput.files[0]);
    }
});

// --- MAIN ANALYSIS (Module 1) ---
analyzeButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        if (window.toast) window.toast.warning('Please upload an image first.');
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Reset UI
    if (aiReplyContent) aiReplyContent.style.display = "none";
    if (resultsEmpty) resultsEmpty.style.display = 'flex';
    if (visualResultDiv) visualResultDiv.style.display = "none";
    if (unifiedSection) unifiedSection.style.display = "none";

    if (confidenceGauge) confidenceGauge.style.display = 'none';
    document.getElementById("disease-info").value = "";

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

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result:", result);

            setStep(3);

            // Hide empty state and show reply content
            if (resultsEmpty) resultsEmpty.style.display = 'none';
            if (aiReplyContent) aiReplyContent.style.display = 'block';

            const confidencePercent = (result.confidence * 100).toFixed(2);
            animateGauge(parseFloat(confidencePercent));

            let infoText = `🌿 Disease: ${result.class}\n💡 Confidence: ${confidencePercent}%`;
            if (result.prevention_measures) {
                infoText += `\n\n🛡️ Tips:\n${result.prevention_measures}`;
            }

            await typeText(document.getElementById("disease-info"), infoText, 10);

            // SAVE DISEASE NAME FOR MODULE 2 & 3
            detectedDiseaseName = result.class;

            // SHOW THE NEW UNIFIED SECTION
            if (unifiedSection) unifiedSection.style.display = "block";

            // Show Grad-CAM
            if (result.explanation_image) {
                gradCamImg.src = "data:image/jpeg;base64," + result.explanation_image;
                if (visualResultDiv) visualResultDiv.style.display = "block";
            }

            saveScanToHistory(result.class, result.confidence);

            if (window.toast) window.toast.success(`Analysis Complete: ${result.class}`);

        } else {
            document.getElementById("disease-info").value = "❌ Prediction failed.";
            setStep(1);
        }
    } catch (error) {
        console.error("❌ Error:", error);
        document.getElementById("disease-info").value = "❌ Server Error. Is main.py running?";
        setStep(1);
    } finally {
        analyzeButton.innerHTML = originalBtnHTML;
        analyzeButton.disabled = false;
    }
});

// --- VISUAL SIMULATION (Module 2) ---
simulateBtn.addEventListener("click", async () => {
    if (!detectedDiseaseName) {
        if (window.toast) window.toast.warning('Please analyze an image first!');
        return;
    }

    const file = fileInput.files[0];
    const context = contextInput.value;

    // UI Updates
    simulateBtn.disabled = true;
    simulateBtn.innerText = "Simulating...";
    globalLoader.style.display = "block";
    futureImg.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease_name", detectedDiseaseName);
    if (context) formData.append("context", context);

    try {
        const response = await fetch("http://127.0.0.1:8000/simulate", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.future_image) {
            futureImg.src = "data:image/jpeg;base64," + data.future_image;
            futureImg.style.display = "block";
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

// --- EXPERT CURE PLAN (Module 3) ---
planBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const loc = locationInput.value;
    const ctx = contextInput.value;

    if (!detectedDiseaseName) return;

    if (!loc || !ctx) {
        if (window.toast) window.toast.warning('Please enter Location and Weather Context.');
        locationInput.style.borderColor = "#e74c3c";
        contextInput.style.borderColor = "#e74c3c";
        setTimeout(() => {
            locationInput.style.borderColor = "#ddd";
            contextInput.style.borderColor = "#ddd";
        }, 2000);
        return;
    }

    planBtn.disabled = true;
    planBtn.innerText = "Consulting...";
    globalLoader.style.display = "block";
    expertResult.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease", detectedDiseaseName);
    formData.append("location", loc);
    formData.append("context", ctx);

    try {
        const response = await fetch("http://127.0.0.1:8000/get_expert_plan", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.plan) {
            let html = data.plan
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n/g, "<br>");
            expertResult.innerHTML = html;
            expertResult.style.display = "block";
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