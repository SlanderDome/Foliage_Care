# ==========================================
#  FOLIAGE CARE: API GATEWAY (Local)
# ==========================================
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import numpy as np
from PIL import Image
import json
import io
import base64
import os
from dotenv import load_dotenv

app = FastAPI()

# --- 1. CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "foliagecare_model.keras")
JSON_PATH = os.path.join(BASE_DIR, "class_indices.json")

# --- 2. LOAD RESOURCES ---
print("🏗️ Loading AI Brain...")
try:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    
    # ⚠️ CRITICAL: Find the last Conv layer
    # Based on your previous code, it's likely "out_relu" or "Conv_1"
    # We try "out_relu" first (standard for MobileNetV2 in Keras)
    try:
        target_layer = MODEL.get_layer("out_relu")
        LAST_CONV_LAYER = "out_relu"
    except:
        target_layer = MODEL.get_layer("Conv_1")
        LAST_CONV_LAYER = "Conv_1"
        
    # Build Grad-Model
    GRAD_MODEL = tf.keras.models.Model(
        [MODEL.inputs], [target_layer.output, MODEL.output]
    )
    print(f"✅ Model & Grad-CAM hooked to layer: {LAST_CONV_LAYER}")

except Exception as e:
    print(f"❌ CRITICAL ERROR: Could not load model. {e}")
    MODEL = None
    GRAD_MODEL = None

# Load Class Names
try:
    with open(JSON_PATH, "r") as f:
        class_indices = json.load(f)
        CLASS_NAMES = {v: k for k, v in class_indices.items()}
    print(f"✅ Loaded {len(CLASS_NAMES)} disease classes.")
except:
    CLASS_NAMES = {}

# Prevention Tips
PREVENTION_TIPS = {
    "Potato___Early_blight": "Use copper-based fungicides. Remove infected leaves.",
    "Potato___Late_blight": "Destroy infected plants immediately. Preventative fungicide.",
    "Potato___healthy": "Healthy! Keep monitoring.",
    "Unknown": "Consult an expert."
}

# --- 3. HELPER FUNCTIONS (From your Hugging Face Code) ---

def apply_turbo_colormap(heatmap):
    """
    Your custom Turbo Colormap function (Pure Numpy)
    Removes the need for OpenCV!
    """
    heatmap = np.clip(heatmap, 0, 1)
    r = np.clip((heatmap - 0.5) * 2, 0, 1) * 255
    g = np.clip(1 - np.abs(heatmap - 0.5) * 2, 0, 1) * 255
    b = np.clip((0.5 - heatmap) * 2, 0, 1) * 255
    return np.stack([r, g, b], axis=-1).astype(np.uint8)

def process_image_for_model(image_bytes):
    """Converts raw bytes to (1, 224, 224, 3) array normalized 0-1"""
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")
    image = image.resize((224, 224))
    img_array = np.array(image) / 255.0
    return np.expand_dims(img_array, axis=0)

def generate_gradcam_heatmap(img_array, pred_index):
    """Generates the Raw Heatmap Matrix"""
    with tf.GradientTape() as tape:
        # Cast to tensor to avoid "graph disconnected" errors
        inputs = tf.cast(img_array, tf.float32)
        tape.watch(inputs)
        
        # Get outputs
        conv_outputs, predictions = GRAD_MODEL(inputs)
        
        # Handle Output Structure (List vs Tensor)
        if isinstance(predictions, list): predictions = predictions[0]
        if isinstance(conv_outputs, list): conv_outputs = conv_outputs[0]
            
        loss = predictions[:, pred_index]

    # Calculate Gradients
    grads = tape.gradient(loss, conv_outputs)
    
    # Pool Gradients
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    # Weighted Sum
    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    # Normalize
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
    return heatmap.numpy()

def overlay_heatmap_turbo(original_bytes, heatmap):
    """Overlays the Turbo heatmap on the original image"""
    # 1. Load Original Image
    original_img = Image.open(io.BytesIO(original_bytes)).convert("RGB")
    
    # 2. Colorize Heatmap (Using your custom function)
    colored_heatmap_array = apply_turbo_colormap(heatmap)
    colored_heatmap = Image.fromarray(colored_heatmap_array)
    
    # 3. Resize Heatmap to match Original Image
    colored_heatmap = colored_heatmap.resize(original_img.size, resample=Image.BILINEAR)
    
    # 4. Blend (Alpha 0.4 means 40% heatmap, 60% original)
    final_image = Image.blend(original_img, colored_heatmap, alpha=0.4)
    
    # 5. Convert to Base64
    buffered = io.BytesIO()
    final_image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


# --- 4. API ENDPOINTS ---

@app.get("/")
def home():
    return {"status": "FoliageCare API Online"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if MODEL is None:
        return {"error": "Model not loaded"}

    # 1. Read Image
    image_bytes = await file.read()
    processed_image = process_image_for_model(image_bytes)
    
    # 2. Prediction
    predictions = MODEL.predict(processed_image)
    predicted_index = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0]))
    class_name = CLASS_NAMES.get(predicted_index, "Unknown")
    
    # 3. Grad-CAM (Using your logic)
    heatmap_base64 = None
    try:
        heatmap = generate_gradcam_heatmap(processed_image, predicted_index)
        heatmap_base64 = overlay_heatmap_turbo(image_bytes, heatmap)
    except Exception as e:
        print(f"Grad-CAM Error: {e}")
    
    # 4. Get Tips
    tip = PREVENTION_TIPS.get(class_name, "Consult an expert.")

    return {
        "class": class_name,
        "confidence": confidence,
        "prevention_measures": tip,
        "explanation_image": heatmap_base64
    }

# ... (Previous imports)
from huggingface_hub import InferenceClient

# --- MODULE 2 CONFIGURATION ---
load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN") 

# We use a fast model optimized for Image-to-Image
# "timbrooks/instruct-pix2pix" is GREAT for editing images (e.g., "make it rainy")
REPO_ID = "timbrooks/instruct-pix2pix"

client = InferenceClient(model=REPO_ID, token=HF_TOKEN)

@app.post("/simulate")
async def simulate_progression(file: UploadFile = File(...), disease_name: str = "disease"):
    """
    Module 2: Generative AI (Temporal Prediction)
    Takes an image -> Returns a 'Worsened' version
    """
    # 1. Read Image
    image_bytes = await file.read()
    original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_image = original_image.resize((512, 512)) # SD likes 512x512

    # 2. Construct the Prompt
    # We tell the AI exactly how to ruin the leaf
    prompt = f"make the {disease_name} much worse, spread the lesions, rotting leaf, severe damage, high contrast, realistic texture"
    
    try:
        # 3. Call Hugging Face (The Magic)
        print(f"🔮 Generating future state for {disease_name}...")
        generated_image = client.image_to_image(
            image=original_image,
            prompt=prompt,
            strength=0.8,         # 0.8 = Change the image a lot!
            guidance_scale=7.5,   # Stick to the prompt
            negative_prompt="blur, cartoon, drawing, healthy, green, recovering"
        )

        # 4. Return as Base64
        buffered = io.BytesIO()
        generated_image.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"future_image": img_str}

    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)







