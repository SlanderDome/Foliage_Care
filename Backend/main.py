# Backend/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
import os
import logging
import asyncio
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plant-disease-api")

app = FastAPI(title="Plant Disease Detection API")

# --- CORS (restrict in production) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend domain(s) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Basic diagnostics on startup ---
logger.info("Working dir: %s", os.listdir("."))
try:
    logger.info("/opt/render/project/src: %s", os.listdir("/opt/render/project/src"))
except Exception:
    # not fatal on local dev
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Model filenames (keep consistent with what you actually uploaded) ---
PLANT_DETECTOR_MODEL = os.path.join(BASE_DIR, "new_plant_detector.keras")
DISEASE_MODEL_FILE = os.path.join(BASE_DIR, "new_disease_model.keras")

PLANT_MODEL: Optional[tf.keras.Model] = None
DISEASE_MODEL: Optional[tf.keras.Model] = None

def load_models():
    global PLANT_MODEL, DISEASE_MODEL
    try:
        if not os.path.exists(PLANT_DETECTOR_MODEL):
            raise FileNotFoundError(f"Model file not found: {PLANT_DETECTOR_MODEL}")
        PLANT_MODEL = tf.keras.models.load_model(PLANT_DETECTOR_MODEL)
        logger.info("Loaded plant detector model: %s", PLANT_DETECTOR_MODEL)

        if not os.path.exists(DISEASE_MODEL_FILE):
            raise FileNotFoundError(f"Model file not found: {DISEASE_MODEL_FILE}")
        DISEASE_MODEL = tf.keras.models.load_model(DISEASE_MODEL_FILE)
        logger.info("Loaded disease classification model: %s", DISEASE_MODEL_FILE)

    except Exception as e:
        logger.exception("Could not load models: %s", e)
        PLANT_MODEL = None
        DISEASE_MODEL = None

# Attempt to load on import/startup
load_models()

# --- Class names (ensure the order matches your disease model's output) ---
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
    # truncated here for brevity — use your same dict from above
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
# (In the real file include the full PREVENTION_MEASURES mapping.)

# --- Utils ---
def read_file_as_image(data: bytes) -> np.ndarray:
    """Convert uploaded image file bytes to a preprocessed numpy array (1,H,W,C)."""
    img = Image.open(BytesIO(data)).convert("RGB")
    img = img.resize((224, 224), Image.BILINEAR)  # match training
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # shape (1,224,224,3)

def is_allowed_file(content_type: str) -> bool:
    return content_type in ("image/jpeg", "image/png", "image/jpg", "image/webp")

@app.get("/ping")
async def ping():
    return {"message": "Hello, I am alive!"}

@app.get("/health")
async def health():
    ok = PLANT_MODEL is not None and DISEASE_MODEL is not None
    return {"models_loaded": ok}

# Run synchronous predict in executor so it doesn't block the event loop
def run_inference(plant_model, disease_model, image_array: np.ndarray):
    """Synchronous inference function suitable for run_in_executor."""
    # Plant detection
    plant_preds = plant_model.predict(image_array)
    # Try to read a sensible plant probability:
    try:
        # if output is (1,1) or (1,), handle both
        if plant_preds.ndim == 2 and plant_preds.shape[1] == 1:
            plant_prob = float(plant_preds[0,0])
        elif plant_preds.ndim == 1:
            plant_prob = float(plant_preds[0])
        else:
            # fallback: take max or first
            plant_prob = float(np.max(plant_preds))
    except Exception:
        plant_prob = float(np.max(plant_preds))

    # Disease prediction
    disease_preds = disease_model.predict(image_array)
    return plant_prob, disease_preds

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if PLANT_MODEL is None or DISEASE_MODEL is None:
        raise HTTPException(status_code=503, detail="Models are not loaded. Check server logs.")

    if not is_allowed_file(file.content_type):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload PNG/JPEG.")

    # optionally limit file size (example: 5MB)
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 5MB allowed.")
    try:
        image = read_file_as_image(data)
    except Exception as e:
        logger.exception("Failed to read image: %s", e)
        raise HTTPException(status_code=400, detail="Could not process image file.")

    # run heavy CPU-bound inference off the event loop
    loop = asyncio.get_running_loop()
    try:
        plant_prob, disease_preds = await loop.run_in_executor(
            None, run_inference, PLANT_MODEL, DISEASE_MODEL, image
        )
    except Exception as e:
        logger.exception("Inference failed: %s", e)
        raise HTTPException(status_code=500, detail="Inference failed. Check server logs.")

    logger.info("Plant probability: %.4f", plant_prob)

    # simple threshold — adjust based on your plant-detector model calibration
    if plant_prob < 0.5:
        return {
            "error": "Image does not appear to be a plant leaf or is unclear.",
            "confidence": round(float(1 - plant_prob), 2),
            "prevention_measures": "Please upload a clear close-up image of a plant leaf for disease detection."
        }

    # process disease_preds
    try:
        preds_array = np.asarray(disease_preds)
        if preds_array.ndim == 2:
            probs = preds_array[0]
        elif preds_array.ndim == 1:
            probs = preds_array
        else:
            probs = probs = np.ravel(preds_array)[: len(CLASS_NAMES)]
    except Exception as e:
        logger.exception("Invalid disease model output shape: %s", e)
        raise HTTPException(status_code=500, detail="Disease model output invalid.")

    predicted_index = int(np.argmax(probs))
    if predicted_index >= len(CLASS_NAMES):
        logger.error("Model predicted index %d out of bounds (len=%d)", predicted_index, len(CLASS_NAMES))
        raise HTTPException(status_code=500, detail="Model prediction out of bounds.")

    predicted_class = CLASS_NAMES[predicted_index]
    confidence = float(np.max(probs))

    logger.info("Predicted: %s (%.2f)", predicted_class, confidence)

    return {
        "class": predicted_class,
        "confidence": round(confidence, 2),
        "prevention_measures": PREVENTION_MEASURES.get(predicted_class, "No prevention tips available for this class.")
    }

if __name__ == "__main__":
    # For local dev. In Render, you typically run uvicorn from the start command.
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("Backend.main:app", host="0.0.0.0", port=port, log_level="info")
