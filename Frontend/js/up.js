const fileInput = document.getElementById("photo");
const analyzeButton = document.getElementById("analyze-button");
const diseaseInfo = document.getElementById("disease-info");
const previewImage = document.getElementById("preview-image");


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

        const response = await fetch("http://127.0.0.1:8002/predict", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log("🌟 Result from Backend →", result);

            
            let infoText = `🌿 Disease: ${result.class}\n💡 Confidence: ${(
                result.confidence * 100
            ).toFixed(2)}%`;
            
           
            if (result.prevention_measures) {
                infoText += `\n\n🛡️ Tips:\n${result.prevention_measures}`;
               
                if (result.class === "Potato___Early_blight") {
                    infoText += "\n\n📚 For more information: https://ipm.ucanr.edu/agriculture/potato/early-blight/#gsc.tab=0";
                } else if (result.class === "Potato___Late_blight") {
                    infoText += "\n\n📚 For more information: https://www.britannica.com/science/late-blight";
                }
            }
            
            diseaseInfo.value = infoText;
        } else {
            diseaseInfo.value = "❌ Prediction failed. Check server logs.";
        }
    } catch (error) {
        console.error("❌ Error during fetch:", error);
        diseaseInfo.value = "❌ Server Error. Check the backend logs.";
    }
});
