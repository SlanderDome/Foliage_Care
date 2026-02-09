const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const diseaseInfo = document.getElementById("disease-info");
const previewImage = document.getElementById("preview-image");

// --- 1. NEW: Function to Save to Firebase ---
async function saveScanToHistory(diseaseResult, confidenceVal) {
    // Check if Firebase is ready and User is logged in
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
        console.log("User not logged in or Firebase not ready. History not saved.");
        return;
    }

    try {
        const user = window.firebaseAuth.currentUser;
        const db = window.db; // From your firebase.js export

        // Format confidence as a readable string if it's a number
        const confidenceStr = (typeof confidenceVal === 'number')
            ? (confidenceVal * 100).toFixed(2) + "%"
            : confidenceVal;

        // Add to "scans" collection
        await window.addDoc(window.collection(db, "scans"), {
            userId: user.uid,
            plantName: "Plant Scan", // You can customize this if you have a plant selector
            disease: diseaseResult,
            confidence: confidenceStr,
            timestamp: window.serverTimestamp(),
            // Simple logic: if it contains "healthy", use a seedling icon, else warning
            icon: diseaseResult.toLowerCase().includes("healthy") ? "fas fa-seedling" : "fas fa-exclamation-triangle"
        });

        console.log("✅ Scan saved to history!");

    } catch (error) {
        console.error("❌ Error saving scan to history:", error);
    }
}
// ------------------------------------------------


fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            previewImage.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});


analyzeButton.addEventListener("click", async (event) => {
    event.preventDefault(); // Prevents page reload

    const file = fileInput.files[0];
    if (!file) {
        alert("Please upload an image first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // UI Elements from your HTML
    const visualResultDiv = document.getElementById("visual-result");
    const gradCamImg = document.getElementById("gradcam-image");
    const infoBox = document.getElementById("disease-info");

    // Reset UI before new scan
    visualResultDiv.style.display = "none";
    infoBox.value = "Analyzing...";

    try {
        console.log("🌿 Sending to Backend...");

        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result from Backend →", result);

            // 1. Calculate confidence
            const confidencePercent = (result.confidence * 100).toFixed(2);

            // 2. Build Text Output
            let infoText = `🌿 Disease: ${result.class}\n💡 Confidence: ${confidencePercent}%`;
            if (result.prevention_measures) {
                infoText += `\n\n🛡️ Tips:\n${result.prevention_measures}`;
            }
            infoBox.value = infoText;

            // 3. SHOW GRAD-CAM (The new part!)
            if (result.explanation_image) {
                // Set the image source to the base64 string
                gradCamImg.src = "data:image/jpeg;base64," + result.explanation_image;

                // Unhide the container div
                visualResultDiv.style.display = "block";
            }

            // 4. Save to Firebase
            saveScanToHistory(result.class, result.confidence);

        } else {
            infoBox.value = "❌ Prediction failed. Check server logs.";
        }
    } catch (error) {
        console.error("❌ Error during fetch:", error);
        infoBox.value = "❌ Server Error. Is the Python backend running?";
    }
});

// --- MODULE 2: SIMULATION LOGIC ---
const simulateBtn = document.getElementById("simulate-btn");
const simulationSection = document.getElementById("simulation-section");
const futureImg = document.getElementById("future-image");
const loader = document.getElementById("loader");

// Variable to store the last detected disease
let currentDisease = "";

// 1. UPDATE YOUR EXISTING ANALYZE LISTENER
// Inside the analyzeButton.addEventListener, where you get 'result.class':
// Add this line:
// currentDisease = result.class;
// simulationSection.style.display = "block"; // Show the section after detection

// 2. NEW LISTENER FOR SIMULATION
simulateBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    // UI Updates
    simulateBtn.disabled = true;
    loader.style.display = "block";
    futureImg.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("disease_name", currentDisease); // Pass the detected disease!

    try {
        const response = await fetch("http://127.0.0.1:8000/simulate", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.future_image) {
            futureImg.src = "data:image/jpeg;base64," + data.future_image;
            futureImg.style.display = "block";
        } else {
            alert("Simulation failed. API might be busy.");
        }
    } catch (e) {
        console.error(e);
        alert("Error connecting to generator.");
    } finally {
        simulateBtn.disabled = false;
        loader.style.display = "none";
    }
});