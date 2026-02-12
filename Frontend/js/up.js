const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const diseaseInfo = document.getElementById("disease-info");
const previewImage = document.getElementById("preview-image");
const resultsEmpty = document.getElementById("results-empty");
const diseaseInfoGroup = document.getElementById("disease-info-group");

// Stepper elements
const stepperSteps = document.querySelectorAll('.stepper-step');
const stepperLines = document.querySelectorAll('.stepper-line');

// Confidence gauge elements
const confidenceGauge = document.getElementById("confidence-gauge");
const gaugeFill = document.getElementById("gauge-fill");
const gaugeValue = document.getElementById("gauge-value");

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

    // Color based on confidence
    let color = '#7cb342'; // green
    if (percent < 50) color = '#c0543a'; // red
    else if (percent < 75) color = '#c9a84c'; // gold

    gaugeFill.style.stroke = color;
    gaugeFill.style.strokeDasharray = circumference;

    // Animate from 0
    gaugeFill.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
        gaugeFill.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)';
        gaugeFill.style.strokeDashoffset = offset;
    });

    // Animate number
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

// --- 1. Firebase Save ---
async function saveScanToHistory(diseaseResult, confidenceVal) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
        console.log("User not logged in or Firebase not ready. History not saved.");
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
        console.error("❌ Error saving scan to history:", error);
    }
}

// --- Update stepper on file upload ---
fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
        setStep(1);
        if (window.toast) window.toast.success('Image loaded — ready to analyze!');
    }
});


// --- Main Analysis ---
analyzeButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        if (window.toast) window.toast.warning('Please upload an image first.');
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const visualResultDiv = document.getElementById("visual-result");
    const gradCamImg = document.getElementById("gradcam-image");
    const infoBox = document.getElementById("disease-info");

    // Reset UI
    visualResultDiv.style.display = "none";
    if (confidenceGauge) confidenceGauge.style.display = 'none';
    infoBox.value = "";

    // Show results area, hide empty state
    if (resultsEmpty) resultsEmpty.style.display = 'none';
    if (diseaseInfoGroup) diseaseInfoGroup.style.display = '';

    // Step 2: Analyzing
    setStep(2);
    if (window.toast) window.toast.info('Analyzing your image…');

    // Show loading state on button
    const originalBtnHTML = analyzeButton.innerHTML;
    analyzeButton.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;"></div> Analyzing…';
    analyzeButton.disabled = true;

    try {
        console.log("🌿 Sending to Backend...");

        const response = await fetch("https://foliage-care-backend.onrender.com/predict", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result from Backend →", result);

            // Step 3: Results
            setStep(3);

            // Confidence
            const confidencePercent = (result.confidence * 100).toFixed(2);

            // Animate confidence gauge
            animateGauge(parseFloat(confidencePercent));

            // Build text
            let infoText = `🌿 Disease: ${result.class}\n💡 Confidence: ${confidencePercent}%`;
            if (result.prevention_measures) {
                infoText += `\n\n🛡️ Tips:\n${result.prevention_measures}`;
            }

            // Typing effect
            await typeText(infoBox, infoText, 10);

            detectedDiseaseName = result.class;
            simSection.style.display = "block";

            // Show Grad-CAM
            if (result.explanation_image) {
                gradCamImg.src = "data:image/jpeg;base64," + result.explanation_image;
                visualResultDiv.style.display = "block";
            }

            // Toast
            const isHealthy = result.class.toLowerCase().includes('healthy');
            if (isHealthy) {
                window.toast && window.toast.success(`✅ Your plant looks healthy! (${confidencePercent}% confidence)`);
            } else {
                window.toast && window.toast.warning(`⚠️ Detected: ${result.class} (${confidencePercent}% confidence)`);
            }

            // Save to Firebase
            saveScanToHistory(result.class, result.confidence);

        } else {
            infoBox.value = "❌ Prediction failed. Check server logs.";
            if (window.toast) window.toast.error('Prediction failed — check server logs.');
            setStep(1);
        }
    } catch (error) {
        console.error("❌ Error during fetch:", error);
        infoBox.value = "❌ Server Error. Is the Python backend running?";
        if (window.toast) window.toast.error('Connection failed — is the server running?');
        setStep(1);
    } finally {
        analyzeButton.innerHTML = originalBtnHTML;
        analyzeButton.disabled = false;
    }
});

// --- MODULE 2: SIMULATION LOGIC ---
const simulateBtn = document.getElementById("simulate-btn");
const simSection = document.getElementById("simulation-section");
const futureImg = document.getElementById("future-image");
const simLoader = document.getElementById("sim-loader");
const futureContainer = document.getElementById("future-container");

let detectedDiseaseName = "";

simulateBtn.addEventListener("click", async () => {
    if (!detectedDiseaseName) {
        if (window.toast) window.toast.warning('Please analyze an image first!');
        return;
    }

    const file = fileInput.files[0];
    if (!file) return;

    // Step 4: Simulate
    setStep(4);

    // UI Updates
    simulateBtn.disabled = true;
    simulateBtn.innerText = "Generating...";
    simLoader.style.display = "block";
    futureContainer.style.display = "none";

    if (window.toast) window.toast.info('Generating future prediction…');

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease_name", detectedDiseaseName);

    try {
        console.log(`🔮 Requesting simulation for: ${detectedDiseaseName}...`);

        const response = await fetch("https://foliage-care-backend.onrender.com/simulate", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.future_image) {
            futureImg.src = "data:image/jpeg;base64," + data.future_image;
            futureContainer.style.display = "block";
            if (window.toast) window.toast.success('Simulation complete!');
        } else {
            console.error("Backend Error:", data);
            if (window.toast) window.toast.error("Simulation failed: " + (data.error || "Unknown error"));
        }

    } catch (e) {
        console.error("Network Error:", e);
        if (window.toast) window.toast.error('Error connecting to the server.');
    } finally {
        simulateBtn.disabled = false;
        simulateBtn.innerHTML = '<i class="fas fa-biohazard"></i> Simulate Progression';
        simLoader.style.display = "none";
    }
});