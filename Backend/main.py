# ==========================================
#  FOLIAGE CARE: API GATEWAY (Local)
#  M1: Detection | M2: Smart Sim | M3: Expert
# ==========================================
import os
import io
import json
import base64
import numpy as np
import tensorflow as tf
import requests
import traceback
from google import genai  # <--- NEW LIBRARY IMPORT
from google.genai import types # <--- For Type Hints if needed
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
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

# PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "foliagecare_model.keras")
JSON_PATH = os.path.join(BASE_DIR, "class_indices.json")

# API KEYS
HF_TOKEN = os.getenv("HF_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini Client (NEW SYNTAX)
gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("✅ Gemini Client Initialized")
    except Exception as e:
        print(f"⚠️ Gemini Init Failed: {e}")

# --- 2. LOAD AI BRAIN (Module 1) ---
print("🏗️ Loading Local AI...")
try:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    try:
        target_layer = MODEL.get_layer("out_relu")
        LAST_CONV_LAYER = "out_relu"
    except:
        target_layer = MODEL.get_layer("Conv_1")
        LAST_CONV_LAYER = "Conv_1"
        
    GRAD_MODEL = tf.keras.models.Model([MODEL.inputs], [target_layer.output, MODEL.output])
    print(f"✅ Local Model Ready (Layer: {LAST_CONV_LAYER})")
except Exception as e:
    print(f"❌ Local Model Failed: {e}")
    MODEL = None

# Load Classes
try:
    with open(JSON_PATH, "r") as f:
        class_indices = json.load(f)
        CLASS_NAMES = {v: k for k, v in class_indices.items()}
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
def process_image_for_model(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    img_array = np.array(image) / 255.0
    return np.expand_dims(img_array, axis=0)

def generate_gradcam_heatmap(img_array, pred_index):
    # Robust List Method
    img_tensor = tf.cast(img_array, tf.float32)
    with tf.GradientTape() as tape:
        tape.watch(img_tensor)
        outputs = GRAD_MODEL([img_tensor])
        conv_outputs, predictions = outputs[0], outputs[1]
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
    # Turbo Colormap (No OpenCV)
    heatmap = np.clip(heatmap, 0, 1)
    r = np.clip((heatmap - 0.5) * 2, 0, 1) * 255
    g = np.clip(1 - np.abs(heatmap - 0.5) * 2, 0, 1) * 255
    b = np.clip((0.5 - heatmap) * 2, 0, 1) * 255
    colormap = np.stack([r, g, b], axis=-1).astype(np.uint8)
    
    original_img = Image.open(io.BytesIO(original_bytes)).convert("RGB")
    colored_heatmap = Image.fromarray(colormap).resize(original_img.size, resample=Image.BILINEAR)
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
    if MODEL is None: return {"error": "Model not loaded"}
    
    image_bytes = await file.read()
    processed_image = process_image_for_model(image_bytes)
    
    predictions = MODEL.predict(processed_image)
    idx = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0]))
    class_name = CLASS_NAMES.get(idx, "Unknown")
    
    # Generate Grad-CAM
    heatmap_base64 = None
    try:
        heatmap = generate_gradcam_heatmap(processed_image, idx)
        heatmap_base64 = overlay_heatmap_turbo(image_bytes, heatmap)
    except Exception as e:
        print(f"⚠️ Grad-CAM Warning: {e}")

    # Get Tips
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
    disease_name: str = Form(...),
    context: str = Form(None)
):
    """Module 2: Smart Simulation (Gemini + Stable Diffusion)"""
    
    # Stable Diffusion API URL
    SD_API_URL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        image_bytes = await file.read()
        
        # 1. Ask Gemini for Prompt (If context exists)
        if context and gemini_client:
            print(f"🧠 Gemini Context: {context}")
            gemini_prompt = f"""
            Describe the visual appearance of a plant leaf with '{disease_name}' 
            after 5 days of untreated progression in these conditions: '{context}'.
            Return ONLY a comma-separated list of visual keywords.
            Example: dark necrotic spots, yellow halos, wilting.
            """
            # NEW SYNTAX
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=gemini_prompt
            )
            visual_descriptors = response.text.strip()
            final_prompt = f"close up photo of a {disease_name} leaf, {visual_descriptors}, realistic, 8k, highly detailed"
        else:
            final_prompt = f"close up photo of a {disease_name} leaf, much worse, severe damage, rotting, realistic texture, 8k"

        print(f"🎨 Generating: {final_prompt}")

        # 2. Call Stable Diffusion
        response = requests.post(
            SD_API_URL,
            headers=headers,
            data=image_bytes, 
            params={
                "inputs": final_prompt,
                "parameters": {
                    "strength": 0.75,
                    "guidance_scale": 8.0,
                    "negative_prompt": "cartoon, drawing, blur, healthy, green"
                }
            }
        )
        
        if response.status_code == 200:
            img_str = base64.b64encode(response.content).decode("utf-8")
            return {"future_image": img_str}
        else:
            return {"error": f"HF Error: {response.text}"}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/get_expert_plan")
async def get_expert_plan(
    file: UploadFile = File(...),
    disease: str = Form(...),
    location: str = Form(...),
    context: str = Form(...)
):
    """Module 3: Expert Plan (Gemini)"""
    if not gemini_client:
        return {"error": "Gemini API Key missing or Client Failed!"}

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))

        prompt = f"""
        Act as a senior agricultural expert.
        
        DIAGNOSIS: '{disease}'.
        LOCATION: {location}
        CONTEXT: {context}
        
        Task:
        1. Confirm if the visual symptoms in the image match {disease}.
        2. Provide a specific 3-step action plan considering the '{context}'.
           - (e.g., if Raining -> stickers/drainage. If Drought -> mulching).
        3. List Immediate Action, Chemical (if safe), and Organic options.
        4. Keep it concise and formatted in Markdown.
        """

        # NEW SYNTAX FOR IMAGES
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image]
        )
        return {"plan": response.text}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)