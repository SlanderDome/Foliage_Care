from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
import os

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # <-- Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = tf.keras.models.load_model("./Models/newmodel.keras")
CLASS_NAMES = ['Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy']

PREVENTION_MEASURES = {
    "Potato___Early_blight": "Maintain proper plant spacing, use disease-free seed potatoes, practice regular crop rotation, apply appropriate fungicides preventatively, and remove infected plant debris promptly.",
    "Potato___Late_blight": "Plant resistant varieties, ensure good drainage and airflow, practice crop rotation, apply preventative fungicides during humid weather, and immediately remove infected plants.",
    "Potato___healthy": "Continue regular monitoring and maintain good agricultural practices to keep your potato plants healthy."
}

@app.get("/ping")
async def ping():
    return "Hello, I am alive!"

def read_file_as_image(data) -> np.ndarray:
    image = np.array(Image.open(BytesIO(data)))
    return image

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        print("✅ Received File:", file.filename)
        image = read_file_as_image(await file.read())
        img_batch = np.expand_dims(image, 0)
        
        print("✅ Image Processed Successfully. Sending for Prediction...")
        predictions = MODEL.predict(img_batch)
        print("✅ Prediction Done.")

        predicted_class = CLASS_NAMES[np.argmax(predictions[0])]
        confidence = float(np.max(predictions[0]))

        print(f"🌟 Predicted: {predicted_class} with {confidence:.2f} confidence")
        
        return {
            "class": predicted_class,
            "confidence": confidence,
            "prevention_measures": PREVENTION_MEASURES[predicted_class]
            
        }
    except Exception as e:
        print(f"❌ Error during prediction: {str(e)}")
        return {"error": "Prediction failed. Check server logs for details."}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)
