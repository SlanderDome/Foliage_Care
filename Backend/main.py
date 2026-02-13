# ==========================================
#  FOLIAGE CARE: API GATEWAY (Local)
#  Modules: Detection (M1), Simulation (M2)
# ==========================================
import os
import io
import json
import base64
import numpy as np
import tensorflow as tf
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form  # <--- Added Form
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

# --- 1. CONFIGURATION ---
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "foliagecare_model.keras")
JSON_PATH = os.path.join(BASE_DIR, "class_indices.json")

# HF Configuration
HF_TOKEN = os.getenv("HF_TOKEN")
# If .env fails, uncomment the line below and paste your token directly for testing:
# HF_TOKEN = "hf_YourTokenHere" 

REPO_ID = "timbrooks/instruct-pix2pix"
client = InferenceClient(model=REPO_ID, token=HF_TOKEN)

# --- 2. LOAD RESOURCES ---
print("🏗️ Loading AI Brain...")

# A. Load Detection Model
try:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    
    # Auto-detect layer name
    try:
        target_layer = MODEL.get_layer("out_relu")
        LAST_CONV_LAYER = "out_relu"
    except ValueError:
        target_layer = MODEL.get_layer("Conv_1")
        LAST_CONV_LAYER = "Conv_1"
        
    GRAD_MODEL = tf.keras.models.Model(
        [MODEL.inputs], [target_layer.output, MODEL.output]
    )
    print(f"✅ Model loaded. Grad-CAM layer: {LAST_CONV_LAYER}")

except Exception as e:
    print(f"❌ CRITICAL ERROR: AI Brain failed. {e}")
    MODEL = None
    GRAD_MODEL = None

# B. Load Class Names
try:
    with open(JSON_PATH, "r") as f:
        class_indices = json.load(f)
        CLASS_NAMES = {v: k for k, v in class_indices.items()}
    print(f"✅ Loaded {len(CLASS_NAMES)} classes.")
except:
    CLASS_NAMES = {}

# Prevention Tips
PREVENTION_TIPS = {
    "Potato___Early_blight": "Use copper-based fungicides. Remove infected leaves.",
    "Potato___Late_blight": "Destroy infected plants immediately. Preventative fungicide.",
    "Potato___healthy": "Healthy! Keep monitoring.",
    "Unknown": "Consult an expert."
}

# --- 3. HELPER FUNCTIONS ---

def apply_turbo_colormap(heatmap):
    """Converts 0-1 heatmap to colored RGB (Turbo scheme)"""
    heatmap = np.clip(heatmap, 0, 1)
    r = np.clip((heatmap - 0.5) * 2, 0, 1) * 255
    g = np.clip(1 - np.abs(heatmap - 0.5) * 2, 0, 1) * 255
    b = np.clip((0.5 - heatmap) * 2, 0, 1) * 255
    return np.stack([r, g, b], axis=-1).astype(np.uint8)

def process_image_for_model(image_bytes):
    """Normalizes image to (1, 224, 224, 3)"""
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")
    image = image.resize((224, 224))
    img_array = np.array(image) / 255.0
    return np.expand_dims(img_array, axis=0)

def generate_gradcam_heatmap(img_array, pred_index):
    """Generates Heatmap (Fixed for Keras Input Warning)"""
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        tape.watch(img_tensor)
        
        # FIX: Pass as list [img_tensor] to satisfy Keras inputs
        outputs = GRAD_MODEL([img_tensor])
        
        conv_outputs = outputs[0]
        predictions = outputs[1]
        
        if isinstance(predictions, list): predictions = predictions[0]
        if isinstance(conv_outputs, list): conv_outputs = conv_outputs[0]
            
        loss = predictions[:, pred_index]

    grads = tape.gradient(loss, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
    return heatmap.numpy()

def overlay_heatmap_turbo(original_bytes, heatmap):
    """Blends heatmap with original image"""
    original_img = Image.open(io.BytesIO(original_bytes)).convert("RGB")
    colored_heatmap = Image.fromarray(apply_turbo_colormap(heatmap))
    colored_heatmap = colored_heatmap.resize(original_img.size, resample=Image.BILINEAR)
    
    final_image = Image.blend(original_img, colored_heatmap, alpha=0.4)
    
    buffered = io.BytesIO()
    final_image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


# --- 4. API ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "FoliageCare API Online"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Module 1: Diagnosis"""
    if MODEL is None:
        return {"error": "Model not loaded"}

    # 1. Read & Preprocess
    image_bytes = await file.read()
    processed_image = process_image_for_model(image_bytes)
    
    # 2. Predict
    predictions = MODEL.predict(processed_image)
    predicted_index = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0]))
    class_name = CLASS_NAMES.get(predicted_index, "Unknown")
    
    # 3. Grad-CAM
    heatmap_base64 = None
    try:
        heatmap = generate_gradcam_heatmap(processed_image, predicted_index)
        heatmap_base64 = overlay_heatmap_turbo(image_bytes, heatmap)
    except Exception as e:
        print(f"⚠️ Grad-CAM Warning: {e}")
    
    # 4. Return
    tip = PREVENTION_TIPS.get(class_name, "Consult an expert.")
    return {
        "class": class_name,
        "confidence": confidence,
        "prevention_measures": tip,
        "explanation_image": heatmap_base64
    }

@app.post("/simulate")
async def simulate_progression(
    file: UploadFile = File(...), 
    disease_name: str = Form(...) # <--- FIX: Using Form() to catch the name
):
    """Module 2: Future Simulation"""
    
    # 1. Read Image
    image_bytes = await file.read()
    original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_image = original_image.resize((512, 512))

    # 2. Prompt
    prompt = f"make the {disease_name} much worse, spread the lesions, rotting leaf, severe damage, high contrast, realistic texture"
    
    try:
        print(f"🔮 Generating future for: {disease_name}...")
        generated_image = client.image_to_image(
            image=original_image,
            prompt=prompt,
            strength=0.8,
            guidance_scale=7.5,
            negative_prompt="blur, cartoon, drawing, healthy, green, recovering"
        )

        buffered = io.BytesIO()
        generated_image.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"future_image": img_str}

    except Exception as e:
        print(f"❌ Simulation Failed: {e}")
        # Return the error to the frontend so you can alert() it
        return {"error": str(e)}
if __name__ == "__main__":
    import uvicorn
    # NEW (Works locally)
    # We remove "Backend." because we are already in that file/folder
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)