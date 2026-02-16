# ==========================================
#  FOLIAGE CARE: API GATEWAY (Final Production)
#  M1: Detection | M2: Smart Sim | M3: Expert
# ==========================================
import os
import re
from datetime import datetime
import io
import json
import base64
import numpy as np
import tensorflow as tf
import requests
import traceback
from google import genai  # <--- NEW LIBRARY
from PIL import Image
from typing import Optional, List
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, Form, Body
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
        print("✅ Gemini Client Initialized (New SDK)")
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

# --- 3.5 AI VISION HELPERS (Gemini Detection) ---
def _build_jet_lut():
    """Pre-compute a 256x3 Jet colormap lookup table."""
    t = np.linspace(0, 1, 256)
    r = np.clip(1.5 - np.abs(t - 0.75) * 4, 0, 1)
    g = np.clip(1.5 - np.abs(t - 0.50) * 4, 0, 1)
    b = np.clip(1.5 - np.abs(t - 0.25) * 4, 0, 1)
    return np.stack([r, g, b], axis=-1)

JET_LUT = _build_jet_lut()

def apply_jet_colormap(heatmap_np):
    """Convert 0-1 float heatmap to RGB using Jet LUT."""
    indices = np.uint8(np.clip(heatmap_np, 0, 1) * 255)
    colored = JET_LUT[indices]
    return (colored * 255).astype(np.uint8)

def generate_ai_mask(original_img, boxes):
    """Draw soft, glowing hotspots based on bounding boxes."""
    width, height = original_img.size
    # Create black mask
    mask_array = np.zeros((height, width), dtype=np.float32)
    
    from PIL import ImageDraw, ImageFilter
    mask_img = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask_img)
    
    for box in boxes:
        # Standard Gemini order [ymin, xmin, ymax, xmax] (normalized 0-1000)
        ymin, xmin, ymax, xmax = box
        left = xmin * width / 1000
        top = ymin * height / 1000
        right = xmax * width / 1000
        bottom = ymax * height / 1000
        
        # Draw soft oval for each symptom
        draw.ellipse([left, top, right, bottom], fill=255)
    
    # Blur mask for that "heatmap" glow
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=max(width, height)//20))
    return np.array(mask_img).astype(np.float32) / 255.0

def overlay_ai_mask(original_img, boxes):
    """Apply Gemini-detected boxes as a professional heatmap overlay."""
    if not boxes:
        return None
        
    mask_np = generate_ai_mask(original_img, boxes)
    colored_heatmap = apply_jet_colormap(mask_np)
    
    heatmap_pil = Image.fromarray(colored_heatmap)
    
    # Weighted Alpha Blend: High activation = 0.5 opacity, Low = 0.0
    # We'll use the mask itself as the alpha channel for a "clean" look
    mask_pil = Image.fromarray((mask_np * 140).astype(np.uint8)) # Max 0.55 opacity
    
    final_image = original_img.copy()
    final_image.paste(heatmap_pil, (0, 0), mask_pil)
    
    buffered = io.BytesIO()
    final_image.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def overlay_heatmap_turbo(original_bytes, heatmap):
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
async def predict(
    file: UploadFile = File(...),
    user_name: str = Form("Farmer"),
    location: str = Form(None),
    context: str = Form(None),
    latitude: str = Form(None),
    longitude: str = Form(None)
):
    """Module 1: Diagnosis & Tailored Report (with Image Validation)"""
    if MODEL is None: return {"error": "Model not loaded"}
    
    image_bytes = await file.read()

    # --- Image Validation: Detect non-plant images ---
    if gemini_client:
        try:
            validation_image = Image.open(io.BytesIO(image_bytes))
            validation_response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    "Does this image contain a plant leaf or crop? Reply with ONLY 'YES' or 'NO'.",
                    validation_image
                ]
            )
            answer = validation_response.text.strip().upper()
            if "NO" in answer:
                print(f"⚠️ Non-plant image detected for {user_name}")
                return {
                    "is_invalid_image": True,
                    "class": "Invalid",
                    "confidence": 0,
                    "prevention_measures": f"Hey {user_name}, this doesn't look like a plant leaf! 🌿 Please upload a clear, close-up photo of the affected leaf so I can give you an accurate diagnosis.",
                    "explanation_image": None
                }
        except Exception as e:
            print(f"⚠️ Image validation warning: {e}")

    processed_image = process_image_for_model(image_bytes)
    
    predictions = MODEL.predict(processed_image)
    idx = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0]))
    class_name = CLASS_NAMES.get(idx, "Unknown")
    
    heatmap_base64 = None
    
    # --- 1. Diagnosis Report & Precision Highlight (Gemini) ---
    if gemini_client:
        loc_str = f"{location} (GPS: {latitude}, {longitude})" if latitude and longitude else (location or "remote field")
        
        # We'll ask Gemini for BOTH the report and the bounding boxes in one go to save API calls
        # (Or two calls if needed for better reliability, but let's try one first)
        combined_prompt = f"""
        Act as a senior plant pathologist. 
        USER: {user_name}
        DIAGNOSIS: {class_name}
        LOCATION: {loc_str}
        DATE: {datetime.now().strftime('%B %d, %Y')}

        TASK 1: Write a professional 2-sentence report. 1. Direct cause/effect. 2. Immediate action for {loc_str} in February.
        TASK 2: Detect all distinct lesions/spots for '{class_name}'. 
        
        OUTPUT FORMAT:
        REPORT: [Your text]
        BOXES: [[ymin, xmin, ymax, xmax], ...] (Normalized 0-1000)
        """
        
        try:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[combined_prompt, pil_img]
            )
            raw_text = response.text
            
            # Extract Report
            report_match = re.search(r'REPORT:\s*(.*?)(?=BOXES:|$)', raw_text, re.DOTALL)
            report_text = report_match.group(1).strip() if report_match else "Consult an expert."
            
            # Extract Boxes and generate AI Highlight
            boxes = []
            box_matches = re.findall(r'\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]', raw_text)
            boxes = [[int(v) for v in m] for m in box_matches]
            
            if boxes:
                print(f"🎯 Gemini detected {len(boxes)} symptoms for {class_name}")
                heatmap_base64 = overlay_ai_mask(pil_img, boxes)
            
        except Exception as e:
            print(f"⚠️ Gemini Precision Highlight failed: {e}")
            report_text = PREVENTION_TIPS.get(class_name, "Consult an expert.")

    # FALLBACK: Traditional Grad-CAM if AI highlight failed or Gemini is unavailable
    if heatmap_base64 is None:
        try:
            heatmap = generate_gradcam_heatmap(processed_image, idx)
            heatmap_base64 = overlay_heatmap_turbo(image_bytes, heatmap)
        except Exception as e:
            print(f"⚠️ Grad-CAM Fallback Warning: {e}")

    return {
        "class": class_name,
        "confidence": confidence,
        "prevention_measures": report_text if gemini_client else PREVENTION_TIPS.get(class_name, "Consult an expert."),
        "explanation_image": heatmap_base64
    }

@app.post("/simulate")
async def simulate_progression(
    file: UploadFile = File(...), 
    disease_name: str = Form(...),
    context: str = Form(None),
    user_name: str = Form("Farmer"),
    latitude: str = Form(None),
    longitude: str = Form(None)
):
    """Module 2: Smart Simulation"""
    SD_API_URL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        image_bytes = await file.read()
        
        # Build precise location string
        loc_str = f"GPS: {latitude}, {longitude}" if latitude and longitude else "remote field"

        # 1. Ask Gemini for Prompt
        if gemini_client:
            print(f"🧠 Gemini Context for {user_name}: {context} @ {loc_str}")
            gemini_prompt = f"""
            Act as a visual strategist for {user_name}'s farm located at {loc_str}.
            Current date: {datetime.now().strftime('%B %d, %Y')}.
            Describe the visual appearance of a plant leaf with '{disease_name}' 
            after 5 days of untreated progression in these exact conditions: '{context}'.
            
            Return ONLY a comma-separated list of visual keywords (e.g., soggy brown rims, fungal fuzz, yellow veins).
            Focus on the high-detail visual decay patterns tailored to the environment and current season.
            """
            try:
                response = gemini_client.models.generate_content(
                    model="gemini-2.5-flash", 
                    contents=gemini_prompt
                )
                visual_descriptors = response.text.strip()
                final_prompt = f"close up photo of a {disease_name} leaf on {user_name}'s farm, {visual_descriptors}, realistic, 8k, macro photography"
            except Exception as e:
                print(f"⚠️ Gemini Prompt Error: {e}")
                final_prompt = f"close up photo of a {disease_name} leaf, severe decay, necrotic spots, realistic texture, 8k"
        else:
            final_prompt = f"close up photo of a {disease_name} leaf, severe damage, rotting, realistic texture, 8k"

        print(f"🎨 Generating: {final_prompt}")

        # 2. Call Stable Diffusion
        response = requests.post(
            SD_API_URL,
            headers=headers,
            data=image_bytes, 
            params={
                "inputs": final_prompt,
                "parameters": {"strength": 0.75, "guidance_scale": 8.0}
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
    context: str = Form(...),
    # RESTORED: Context Fields
    user_name: str = Form("Farmer"),
    latitude: str = Form(None),
    longitude: str = Form(None)
):
    """Module 3: Expert Plan (Context Aware)"""
    if not gemini_client:
        return {"error": "Gemini Client Failed"}

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))

        # Build precise location string
        loc_str = location
        if latitude and longitude:
            loc_str = f"{location} (GPS: {latitude}, {longitude})"

        prompt = f"""
        Act as a senior agricultural expert advising {user_name}.
        
        **CASE FILE:**
        - Diagnosis: {disease}
        - Location: {loc_str}
        - Current Date: {datetime.now().strftime('%B %d, %Y')}
        - User Context: {context}
        
        **TASK:**
        1. Confirm the diagnosis from the image.
        2. Provide a localized 3-step action plan (Immediate, Chemical, Organic).
           - Consider the specific climate/soil of {loc_str} and the CURRENT SEASON based on the date above.
           - If context mentions '{context}', adjust advice (e.g., rain-fast chemicals).
        3. Format in clear Markdown.
        """

        # FIXED: Model Name 'gemini-1.5-flash'
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image]
        )
        return {"plan": response.text}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

# --- Follow-Up Request Model ---
class FollowUpRequest(BaseModel):
    question: str
    disease: str
    conversation_history: List[dict] = []
    user_name: str = "Farmer"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.post("/followup")
async def followup(req: FollowUpRequest):
    """Module 4: Follow-Up Questions (Context-Aware)"""
    if not gemini_client:
        return {"error": "Gemini Client Failed"}

    try:
        loc_str = f"GPS: {req.latitude}, {req.longitude}" if req.latitude and req.longitude else "unknown location"

        # Build conversation context from history
        history_text = "\n".join(
            [f"{'USER' if h.get('role') == 'user' else 'AI'}: {h.get('text', '')}" for h in req.conversation_history[-6:]]
        )

        prompt = f"""
        You are FoliageCare AI, a plant pathology expert consulting with {req.user_name}.
        
        **CASE FILE:**
        - Current Diagnosis: {req.disease}
        - Location: {loc_str}
        - Current Date: {datetime.now().strftime('%B %d, %Y')}
        
        **CONVERSATION SO FAR:**
        {history_text}
        
        **USER'S NEW QUESTION:**
        {req.question}
        
        Provide a helpful, concise answer. Be specific to the diagnosed disease and the user's context.
        If the question is unrelated to plant care, gently redirect them.
        Use Markdown formatting for readability.
        """

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"reply": response.text.strip()}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)