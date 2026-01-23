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
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
        alert("Please upload an image first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);


    try {
        console.log("🌿 Sending to Backend...");

        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result from Backend →", result);

            // Calculate confidence
            const confidencePercent = (result.confidence * 100).toFixed(2);

            // Display Text
            let infoText = `🌿 Disease: ${result.class}\n💡 Confidence: ${confidencePercent}%`;

            if (result.prevention_measures) {
                infoText += `\n\n🛡️ Tips:\n${result.prevention_measures}`;

                if (result.class === "Potato___Early_blight") {
                    infoText += "\n\n📚 For more information: https://ipm.ucanr.edu/agriculture/potato/early-blight/#gsc.tab=0";
                } else if (result.class === "Potato___Late_blight") {
                    infoText += "\n\n📚 For more information: https://www.britannica.com/science/late-blight";
                }
            }

            diseaseInfo.value = infoText;

            // --- 2. NEW: Save result to Firebase ---
            // We pass the class name and the raw confidence number
            saveScanToHistory(result.class, result.confidence);

        } else {
            diseaseInfo.value = "❌ Prediction failed. Check server logs.";
        }
    } catch (error) {
        console.error("❌ Error during fetch:", error);
        diseaseInfo.value = "❌ Server Error. Check the backend logs.";
    }
});