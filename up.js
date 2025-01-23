document.addEventListener("DOMContentLoaded", function() {
    const takePhotoButton = document.getElementById("take-photo-button");
    const uploadPhotoButton = document.getElementById("upload-photo");
    const photoInput = document.getElementById("photo");
    const previewImage = document.getElementById("preview-image");
    const form = document.getElementById("form");
  
    // Handle Photo Upload
    uploadPhotoButton.addEventListener("click", () => {
      photoInput.click();
    });
  
    // Handle Image Preview
    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          previewImage.style.display = "block";
          previewImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  
    // Simulate disease analysis (for now, just show an alert)
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const diseaseInfo = document.getElementById("disease-info");
      diseaseInfo.value = "Early-Blight in a Potato";
    });
  });
  