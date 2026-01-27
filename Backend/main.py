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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- PATHS TO YOUR WEIGHT FILES ---
# Make sure these match exactly what is in your folder
PLANT_WEIGHTS_FILE = os.path.join(BASE_DIR, "models", "check_weights.weights.h5")
DISEASE_WEIGHTS_FILE = os.path.join(BASE_DIR, "models", "disease_weights.weights.h5")


# --- 1. BUILDER: Plant Detector (Binary) ---
# Matches: MobileNetV2 -> GlobalAvg -> Dense(64) -> Dropout(0.3) -> Dense(1, sigmoid)
def build_plant_model():
    base_model = tf.keras.applications.MobileNetV2(
        weights=None, 
        include_top=False, 
        input_shape=(224, 224, 3)
    )
    base_model.trainable = False

    # Using Functional API style (as per your training script)
    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = base_model(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(64, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid")(x)

    model = tf.keras.Model(inputs, outputs)
    return model

# --- 2. BUILDER: Disease Detector (Multi-class) ---
# Matches: MobileNetV2 -> GlobalAvg -> Dense(128) -> Dropout(0.5) -> Dense(22, softmax)
def build_disease_model():
    base_model = tf.keras.applications.MobileNetV2(
        weights=None,
        include_top=False,
        input_shape=(224, 224, 3)
    )
    base_model.trainable = False 

    model = tf.keras.Sequential([
        base_model,
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(22, activation='softmax')
    ])
    
    # Initialize inputs
    model.build((None, 224, 224, 3))
    return model


# --- LOAD MODELS ---
try:
    print("-----------------------------------")
    # Load Plant Detector
    if not os.path.exists(PLANT_WEIGHTS_FILE):
        raise FileNotFoundError(f"Missing file: {PLANT_WEIGHTS_FILE}")
    
    print("🔨 Building Plant Detector...")
    PLANT_MODEL = build_plant_model()
    print(f"📥 Loading weights from {os.path.basename(PLANT_WEIGHTS_FILE)}...")
    PLANT_MODEL.load_weights(PLANT_WEIGHTS_FILE)

    # Load Disease Detector
    if not os.path.exists(DISEASE_WEIGHTS_FILE):
        raise FileNotFoundError(f"Missing file: {DISEASE_WEIGHTS_FILE}")

    print("🔨 Building Disease Detector...")
    DISEASE_MODEL = build_disease_model()
    print(f"📥 Loading weights from {os.path.basename(DISEASE_WEIGHTS_FILE)}...")
    DISEASE_MODEL.load_weights(DISEASE_WEIGHTS_FILE)

    print("✅ All models loaded successfully.")
    print("-----------------------------------")

except Exception as e:
    print(f"❌ CRITICAL ERROR: Could not load models. {e}")
    traceback.print_exc()
    PLANT_MODEL = None
    DISEASE_MODEL = None


# --- CONFIGURATION ---
CLASS_NAMES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___healthy",
    "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy", "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot", "Peach___healthy", "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy", "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy"
]

PREVENTION_MEASURES = {
    "Apple___Apple_scab": "Prune trees to improve air circulation. Apply fungicides.",
    "Apple___Black_rot": "Remove infected fruit and branches. Apply fungicide.",
    "Apple___Cedar_apple_rust": "Remove nearby junipers. Apply fungicide sprays.",
    "Apple___healthy": "Maintain proper watering and nutrition.",
    "Cherry_(including_sour)___Powdery_mildew": "Improve airflow and apply sulfur fungicides.",
    "Cherry_(including_sour)___healthy": "Maintain watering and pruning.",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Crop rotation and resistant hybrids.",
    "Corn_(maize)___Common_rust_": "Plant resistant varieties.",
    "Corn_(maize)___Northern_Leaf_Blight": "Use resistant hybrids.",
    "Corn_(maize)___healthy": "Ensure proper nutrients and irrigation.",
    "Grape___Black_rot": "Prune vines and apply fungicides.",
    "Grape___Esca_(Black_Measles)": "Remove infected wood.",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Remove fallen leaves and improve airflow.",
    "Grape___healthy": "Maintain proper pruning and spraying.",
    "Orange___Haunglongbing_(Citrus_greening)": "Remove infected trees immediately.",
    "Peach___Bacterial_spot": "Use resistant varieties and copper sprays.",
    "Peach___healthy": "Prune and maintain tree health.",
    "Pepper,_bell___Bacterial_spot": "Use disease-free seed and crop rotation.",
    "Pepper,_bell___healthy": "Provide consistent watering.",
    "Potato___Early_blight": "Use clean seed potatoes and fungicides.",
    "Potato___Late_blight": "Plant resistant varieties.",
    "Potato___healthy": "Maintain soil moisture and nutrition.",
}


def read_file_as_image(data) -> np.ndarray:
    image = Image.open(BytesIO(data)).convert("RGB")
    image = image.resize((224, 224))
    image = np.array(image) / 255.0
    return np.expand_dims(image, axis=0)


@app.get("/ping")
async def ping():
    return {"message": "Hello, I am alive!"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if PLANT_MODEL is None or DISEASE_MODEL is None:
        return {"error": "Models are not loaded. Check server logs."}

    try:
        print(f"✅ Received file: {file.filename}")

        image_data = await file.read()
        image = read_file_as_image(image_data)

        # 1. Check if it is a plant
        plant_pred_raw = PLANT_MODEL.predict(image)
        plant_pred = float(np.squeeze(plant_pred_raw))

        # IMPORTANT: Threshold check
        # Since your model is 'sigmoid', 0 = Not Plant, 1 = Plant (usually)
        # BUT double check your class_mode='binary' labels.
        # Typically class 0 is first alphabetically, 1 is second.
        # If your folders were "0_not_plant" and "1_plant", then > 0.5 is Plant.
        # If you find the logic is reversed, change this to: if plant_pred > 0.5:
        if plant_pred < 0.5:
            return {
                "error": "This is not a valid plant image",
                "confidence": round(1 - plant_pred, 2),
                "prevention_measures": "Upload a clear plant leaf image.",
            }

        # 2. Detect Disease
        predictions = DISEASE_MODEL.predict(image)
        predicted_index = int(np.argmax(predictions[0]))
        predicted_class = CLASS_NAMES[predicted_index]
        confidence = float(np.max(predictions[0]))

        return {
            "class": predicted_class,
            "confidence": round(confidence, 2),
            "prevention_measures": PREVENTION_MEASURES.get(
                predicted_class,
                "No prevention tips available."
            ),
        }

    except Exception as e:
        print(f"❌ Error during prediction: {e}")
        traceback.print_exc()
        return {"error": "Prediction failed."}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)