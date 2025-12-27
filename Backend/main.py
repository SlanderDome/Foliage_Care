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
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLANT_DETECTOR_MODEL = os.path.join(BASE_DIR, "new_plant_detector.keras")
DISEASE_MODEL_FILE = os.path.join(BASE_DIR, "new_disease_model.keras")


try:
    if not os.path.exists(PLANT_DETECTOR_MODEL):
        raise FileNotFoundError(f"Model file not found: {PLANT_DETECTOR_MODEL}")
    PLANT_MODEL = tf.keras.models.load_model(PLANT_DETECTOR_MODEL, compile=False)
    
    if not os.path.exists(DISEASE_MODEL_FILE):
        raise FileNotFoundError(f"Model file not found: {DISEASE_MODEL_FILE}")
    DISEASE_MODEL = tf.keras.models.load_model(DISEASE_MODEL_FILE, compile=False)
    
    print("✅ All models loaded successfully.")

except Exception as e:
    print(f"❌ CRITICAL ERROR: Could not load models. {e}")
    print("Please make sure 'plant_detector.h5' and 'new_disease_model.h5' are in the same folder.")
    PLANT_MODEL = None
    DISEASE_MODEL = None


CLASS_NAMES = [
    'Apple___Apple_scab',
    'Apple___Black_rot',
    'Apple___Cedar_apple_rust',
    'Apple___healthy',
    'Cherry_(including_sour)___Powdery_mildew',
    'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight',
    'Corn_(maize)___healthy',
    'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)',
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)',
    'Peach___Bacterial_spot',
    'Peach___healthy',
    'Pepper,_bell___Bacterial_spot',
    'Pepper,_bell___healthy',
    'Potato___Early_blight',
    'Potato___Late_blight',
    'Potato___healthy'
]


PREVENTION_MEASURES = {
    # Apple
    'Apple___Apple_scab': "Prune trees to improve air circulation. Rake and destroy fallen leaves. Apply fungicides from bud break until midsummer.",
    'Apple___Black_rot': "Prune out dead or diseased branches. Remove mummified fruit. Apply fungicide sprays during the growing season.",
    'Apple___Cedar_apple_rust': "Remove nearby juniper and red cedar trees if possible. Apply fungicides from pink-bud stage through second cover spray.",
    'Apple___healthy': "Continue good watering, pruning, and fertilization practices. Monitor for pests.",
    
    # Cherry
    'Cherry_(including_sour)___Powdery_mildew': "Ensure good air circulation via pruning. Apply fungicides (like sulfur) at first sign of disease and repeat as needed.",
    'Cherry_(including_sour)___healthy': "Maintain consistent watering. Prune to an open center. Monitor for pests like aphids.",
    
    # Corn (Maize)
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': "Practice crop rotation with non-host crops. Use resistant hybrids. Tillage can help bury residue.",
    'Corn_(maize)___Common_rust_': "Plant resistant hybrids. Fungicides are effective but often not economically necessary unless severe on sweet corn.",
    'Corn_(maize)___Northern_Leaf_Blight': "Use resistant hybrids. Practice crop rotation and tillage. Apply fungicides if disease is severe.",
    'Corn_(maize)___healthy': "Ensure proper nitrogen levels and adequate water, especially during tasseling.",
    
    # Grape
    'Grape___Black_rot': "Prune vines and remove diseased canes. Rake and destroy mummified berries. Apply fungicides during the growing season.",
    'Grape___Esca_(Black_Measles)': "Prune out and destroy diseased wood. Late pruning (in winter) can help. No effective chemical control.",
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': "Practice good sanitation by removing fallen leaves. Ensure good air circulation. Fungicides for black rot will also control this.",
    'Grape___healthy': "Maintain a good pruning and spraying schedule. Ensure proper trellising for air flow.",
    
    # Orange
    'Orange___Haunglongbing_(Citrus_greening)': "This disease is very serious. Remove infected trees immediately. Control the Asian citrus psyllid (the insect that spreads it).",
    
    # Peach
    'Peach___Bacterial_spot': "Use resistant varieties. Apply bactericides (copper-based) in dormant season and early spring. Maintain tree vigor.",
    'Peach___healthy': "Prune to an open vase shape. Thin fruit to prevent brown rot. Use dormant oil sprays for pests.",
    
    # Pepper, Bell
    'Pepper,_bell___Bacterial_spot': "Use disease-free seed. Rotate crops (don't plant where tomatoes/peppers were). Apply copper-based bactericides.",
    'Pepper,_bell___healthy': "Provide consistent watering. Stake plants to prevent breakage. Fertilize when fruit begins to set.",
    
    # Potato
    'Potato___Early_blight': "Use disease-free seed potatoes. Practice crop rotation. Apply fungicides preventatively.",
    'Potato___Late_blight': "Plant resistant varieties. Ensure good drainage. Apply preventative fungicides, especially in cool, wet weather.",
    'Potato___healthy': "Ensure consistent watering. Hill soil around plants to protect tubers from sun."
}


def read_file_as_image(data) -> np.ndarray:
    """Convert uploaded image file to a preprocessed numpy array"""
    
    image = Image.open(BytesIO(data)).convert("RGB")
    image = image.resize((224, 224)) 
    image = np.array(image) / 255.0 # Rescale to [0,1]
    return np.expand_dims(image, axis=0)


@app.get("/ping")
async def ping():
    return {"message": "Hello, I am alive!"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not PLANT_MODEL or not DISEASE_MODEL:
        return {"error": "Models are not loaded. Check server logs."}
        
    try:
        print(f"✅ Received file: {file.filename}")
        image_data = await file.read()
        image = read_file_as_image(image_data)

     
        plant_pred = PLANT_MODEL.predict(image)[0][0]
        print(f"🌱 Plant probability: {plant_pred:.4f}")

        if plant_pred < 0.5:  
            return {
                "Error": "This is not an accurate image",
                "confidence": round(float(1 - plant_pred), 2),
                "prevention_measures": "Please upload a clear image of a plant leaf for accurate disease detection."
            }

        
        predictions = DISEASE_MODEL.predict(image)
        predicted_index = np.argmax(predictions[0])
        
        if predicted_index >= len(CLASS_NAMES):
            print(f"❌ Error: Model predicted index {predicted_index} which is out of bounds for {len(CLASS_NAMES)} classes.")
            return {"error": "Model prediction error. Check class list."}

        predicted_class = CLASS_NAMES[predicted_index]
        confidence = float(np.max(predictions[0]))

        print(f"🌟 Predicted: {predicted_class} with {confidence:.2f} confidence")

        return {
            "class": predicted_class,
            "confidence": round(confidence, 2),
            "prevention_measures": PREVENTION_MEASURES.get(predicted_class, "No prevention tips available for this class.")
        }

    except Exception as e:
        print(f"❌ Error during prediction: {str(e)}")
        return {"error": "Prediction failed. Check server logs for details."}


if __name__ == "__main__":

    port = int(os.environ.get("PORT", 8000))
uvicorn.run(app, host="0.0.0.0", port=port)

