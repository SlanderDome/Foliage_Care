from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
import os
import logging
from typing import Optional
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Plant Disease Detection API",
    description="API for detecting plant diseases from leaf images",
    version="1.0.0"
)

# CORS Configuration - Update with your actual frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific origins in production
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)}
    )

# Model paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLANT_DETECTOR_MODEL = os.path.join(BASE_DIR, "new_plant_detector.keras")
DISEASE_MODEL_FILE = os.path.join(BASE_DIR, "new_disease_model.keras")

# Class names
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
    'Apple___Apple_scab': "Prune trees to improve air circulation. Rake and destroy fallen leaves. Apply fungicides from bud break until midsummer.",
    'Apple___Black_rot': "Prune out dead or diseased branches. Remove mummified fruit. Apply fungicide sprays during the growing season.",
    'Apple___Cedar_apple_rust': "Remove nearby juniper and red cedar trees if possible. Apply fungicides from pink-bud stage through second cover spray.",
    'Apple___healthy': "Continue good watering, pruning, and fertilization practices. Monitor for pests.",
    'Cherry_(including_sour)___Powdery_mildew': "Ensure good air circulation via pruning. Apply fungicides (like sulfur) at first sign of disease and repeat as needed.",
    'Cherry_(including_sour)___healthy': "Maintain consistent watering. Prune to an open center. Monitor for pests like aphids.",
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': "Practice crop rotation with non-host crops. Use resistant hybrids. Tillage can help bury residue.",
    'Corn_(maize)___Common_rust_': "Plant resistant hybrids. Fungicides are effective but often not economically necessary unless severe on sweet corn.",
    'Corn_(maize)___Northern_Leaf_Blight': "Use resistant hybrids. Practice crop rotation and tillage. Apply fungicides if disease is severe.",
    'Corn_(maize)___healthy': "Ensure proper nitrogen levels and adequate water, especially during tasseling.",
    'Grape___Black_rot': "Prune vines and remove diseased canes. Rake and destroy mummified berries. Apply fungicides during the growing season.",
    'Grape___Esca_(Black_Measles)': "Prune out and destroy diseased wood. Late pruning (in winter) can help. No effective chemical control.",
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': "Practice good sanitation by removing fallen leaves. Ensure good air circulation. Fungicides for black rot will also control this.",
    'Grape___healthy': "Maintain a good pruning and spraying schedule. Ensure proper trellising for air flow.",
    'Orange___Haunglongbing_(Citrus_greening)': "This disease is very serious. Remove infected trees immediately. Control the Asian citrus psyllid (the insect that spreads it).",
    'Peach___Bacterial_spot': "Use resistant varieties. Apply bactericides (copper-based) in dormant season and early spring. Maintain tree vigor.",
    'Peach___healthy': "Prune to an open vase shape. Thin fruit to prevent brown rot. Use dormant oil sprays for pests.",
    'Pepper,_bell___Bacterial_spot': "Use disease-free seed. Rotate crops (don't plant where tomatoes/peppers were). Apply copper-based bactericides.",
    'Pepper,_bell___healthy': "Provide consistent watering. Stake plants to prevent breakage. Fertilize when fruit begins to set.",
    'Potato___Early_blight': "Use disease-free seed potatoes. Practice crop rotation. Apply fungicides preventatively.",
    'Potato___Late_blight': "Plant resistant varieties. Ensure good drainage. Apply preventative fungicides, especially in cool, wet weather.",
    'Potato___healthy': "Ensure consistent watering. Hill soil around plants to protect tubers from sun."
}

# Response models
class PredictionResponse(BaseModel):
    success: bool
    class_name: Optional[str] = None
    confidence: Optional[float] = None
    prevention_measures: Optional[str] = None
    error: Optional[str] = None
    is_plant: Optional[bool] = None

class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    message: str

# Load models
def load_models():
    """Load TensorFlow models with proper error handling"""
    try:
        logger.info(f"📁 Working directory: {os.getcwd()}")
        logger.info(f"📁 BASE_DIR: {BASE_DIR}")
        
        if not os.path.exists(PLANT_DETECTOR_MODEL):
            raise FileNotFoundError(f"Plant detector model not found: {PLANT_DETECTOR_MODEL}")
        
        if not os.path.exists(DISEASE_MODEL_FILE):
            raise FileNotFoundError(f"Disease model not found: {DISEASE_MODEL_FILE}")
        
        # Load models with compile=False to avoid architecture issues
        plant_model = tf.keras.models.load_model(
            PLANT_DETECTOR_MODEL,
            compile=False
        )
        logger.info("✅ Plant detector model loaded")
        
        disease_model = tf.keras.models.load_model(
            DISEASE_MODEL_FILE,
            compile=False
        )
        logger.info("✅ Disease detection model loaded")
        
        # Warm up models with dummy prediction
        dummy_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
        plant_model.predict(dummy_input, verbose=0)
        disease_model.predict(dummy_input, verbose=0)
        logger.info("🔥 Models warmed up and ready")
        
        return plant_model, disease_model
        
    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR loading models: {e}", exc_info=True)
        return None, None

# Initialize models
PLANT_MODEL, DISEASE_MODEL = load_models()

# Helper functions
def read_file_as_image(data) -> np.ndarray:
    """Convert uploaded image file to a preprocessed numpy array"""
    try:
        image = Image.open(BytesIO(data)).convert("RGB")
        image = image.resize((224, 224))
        image_array = np.array(image, dtype=np.float32) / 255.0
        return np.expand_dims(image_array, axis=0)
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file")

def validate_image_file(file: UploadFile):
    """Validate uploaded file"""
    # Check content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image (JPEG, PNG, etc.)"
        )
    
    # Check file size (10MB limit)
    MAX_SIZE = 10 * 1024 * 1024
    if hasattr(file, 'size') and file.size > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must be less than 10MB"
        )

# API Endpoints
@app.get("/", response_model=dict)
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Plant Disease Detection API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/ping",
            "predict": "/predict (POST)",
            "docs": "/docs"
        }
    }

@app.get("/ping", response_model=HealthResponse)
async def ping():
    """Health check endpoint"""
    models_loaded = PLANT_MODEL is not None and DISEASE_MODEL is not None
    return HealthResponse(
        status="healthy" if models_loaded else "degraded",
        models_loaded=models_loaded,
        message="API is running" if models_loaded else "Models not loaded"
    )

@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """
    Predict plant disease from uploaded image
    
    Returns:
        - class_name: Detected disease class
        - confidence: Prediction confidence (0-1)
        - prevention_measures: Recommended prevention steps
    """
    # Check if models are loaded
    if not PLANT_MODEL or not DISEASE_MODEL:
        logger.error("Models not loaded")
        return PredictionResponse(
            success=False,
            error="Models are not loaded. Please contact administrator."
        )
    
    try:
        # Validate file
        validate_image_file(file)
        
        logger.info(f"✅ Received file: {file.filename} ({file.content_type})")
        
        # Read and preprocess image
        image_data = await file.read()
        image = read_file_as_image(image_data)
        
        # Step 1: Check if it's a plant
        plant_pred = PLANT_MODEL.predict(image, verbose=0)[0][0]
        logger.info(f"🌱 Plant probability: {plant_pred:.4f}")
        
        if plant_pred < 0.5:
            return PredictionResponse(
                success=False,
                is_plant=False,
                confidence=round(float(1 - plant_pred), 2),
                error="This does not appear to be a plant leaf image",
                prevention_measures="Please upload a clear image of a plant leaf for accurate disease detection."
            )
        
        # Step 2: Predict disease
        predictions = DISEASE_MODEL.predict(image, verbose=0)
        predicted_index = np.argmax(predictions[0])
        
        if predicted_index >= len(CLASS_NAMES):
            logger.error(f"❌ Predicted index {predicted_index} out of bounds for {len(CLASS_NAMES)} classes")
            return PredictionResponse(
                success=False,
                error="Model prediction error. Invalid class index."
            )
        
        predicted_class = CLASS_NAMES[predicted_index]
        confidence = float(np.max(predictions[0]))
        
        logger.info(f"🌟 Predicted: {predicted_class} with {confidence:.2f} confidence")
        
        return PredictionResponse(
            success=True,
            is_plant=True,
            class_name=predicted_class,
            confidence=round(confidence, 2),
            prevention_measures=PREVENTION_MEASURES.get(
                predicted_class,
                "No prevention tips available for this class."
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error during prediction: {str(e)}", exc_info=True)
        return PredictionResponse(
            success=False,
            error=f"Prediction failed: {str(e)}"
        )

# Run server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",  # Required for deployment platforms
        port=port,
        log_level="info"
    )