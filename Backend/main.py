# Backend/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
import os
import traceback

app = FastAPI()

# CORS: in prod, replace "*" with your frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Working dir debug (will appear in Render logs)
print("📁 CWD:", os.getcwd())
print("📁 Files in CWD:", os.listdir("."))
print("📁 Files in /opt/render/project/src:", os.listdir("/opt/render/project/src"))

# Paths relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLANT_PATH = os.path.join(BASE_DIR, "new_plant_detector.keras")
DISEASE_PATH = os.path.join(BASE_DIR, "new_disease_model.keras")

PLANT_MODEL = None
DISEASE_MODEL = None

# Load models (compile=False -> inference only, avoids optimizer issues)
try:
    if not os.path.exists(PLANT_PATH):
        raise FileNotFoundError(f"Plant model not found at {PLANT_PATH}")
    print("Loading plant model from:", PLANT_PATH)
    PLANT_MODEL = tf.keras.models.load_model(PLANT_PATH, compile=False)

    if not os.path.exists(DISEASE_PATH):
        raise FileNotFoundError(f"Disease model not found at {DISEASE_PATH}")
    print("Loading disease model from:", DISEASE_PATH)
    DISEASE_MODEL = tf.keras.models.load_model(DISEASE_PATH, compile=False)

    print("✅ Models loaded successfully.")
    # Print summaries (small) to logs for verification
    try:
        PLANT_MODEL.summary()
        DISEASE_MODEL.summary()
    except Exception:
        print("Could not print model.summary() (may be large).")

except Exception as e:
    print("❌ CRITICAL ERROR loading models:", str(e))
    traceback.print_exc()
    PLANT_MODEL = None
    DISEASE_MODEL = None


# ----------------
# Class names & tips (keep as you had)
CLASS_NAMES = [
    'Apple___Apple_scab','Apple___Black_rot','Apple___Cedar_apple_rust','Apple___healthy',
    'Cherry_(including_sour)___Powdery_mildew','Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot','Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight','Corn_(maize)___healthy',
    'Grape___Black_rot','Grape___Esca_(Black_Measles)','Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy','Orange___Haunglongbing_(Citrus_greening)','Peach___Bacterial_spot',
    'Peach___healthy','Pepper,_bell___Bacterial_spot','Pepper,_bell___healthy',
    'Potato___Early_blight','Potato___Late_blight','Potato___healthy'
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

# Preprocess function (exactly match training)
TARGET_SIZE = (224, 224)
def preprocess_image_bytes(data: bytes) -> np.ndarray:
    img = Image.open(BytesIO(data)).convert("RGB")
    # optional: center-crop to square to reduce background influence
    w, h = img.size
    if w != h:
        min_side = min(w,h)
        left = (w - min_side)//2
        top = (h - min_side)//2
        img = img.crop((left, top, left+min_side, top+min_side))
    img = img.resize(TARGET_SIZE, Image.BILINEAR)
    arr = np.asarray(img).astype(np.float32) / 255.0
    return np.expand_dims(arr, axis=0)   # shape (1,224,224,3)

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/ping")
def ping():
    return {"message": "Hello, I am alive!"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if PLANT_MODEL is None or DISEASE_MODEL is None:
        return {"error": "Models not loaded. Check server logs."}

    try:
        data = await file.read()
        img = preprocess_image_bytes(data)  # float32 normalized array

        # Plant detector - ensure scalar
        plant_pred = PLANT_MODEL.predict(img)
        plant_prob = float(np.array(plant_pred).reshape(-1)[0])  # robust extraction
        print("🌱 Plant probability:", plant_prob)

        if plant_prob < 0.5:
            return {
                "class": "Not a plant",
                "confidence": round(1.0 - plant_prob, 2),
                "prevention_measures": "Please upload a clear image of a plant leaf."
            }

        # Disease prediction
        preds = DISEASE_MODEL.predict(img)
        preds = np.asarray(preds).reshape(-1)
        top_idx = int(np.argmax(preds))
        if top_idx >= len(CLASS_NAMES):
            print("❌ Model index out of range:", top_idx, "len:", len(CLASS_NAMES))
            return {"error": "Model predicted invalid class index."}

        cls = CLASS_NAMES[top_idx]
        conf = float(preds[top_idx])
        return {
            "class": cls,
            "confidence": round(conf, 2),
            "prevention_measures": PREVENTION_MEASURES.get(cls, "No tips available.")
        }

    except Exception as e:
        print("❌ Error during prediction:", str(e))
        traceback.print_exc()
        return {"error": "Prediction failed. Check server logs."}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
