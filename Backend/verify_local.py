# Backend/verify_local.py
import tensorflow as tf
import numpy as np
import os
import sys

# Add path to import utils
sys.path.append(os.getcwd())
from utils.gradcam_handler import generate_and_save_gradcam

# --- 1. DEFINE ARCHITECTURE LOCALLY ---
# We copy this exactly from your training script to ensure compatibility
def build_model_locally():
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras import layers, models

    print("🏗️ Reconstructing model architecture...")
    IMG_SIZE = (224, 224)
    
    # Recreate the base
    base_model = MobileNetV2(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet' # Weights don't matter here, we will overwrite them
    )
    base_model.trainable = False 

    # Recreate the classifier head
    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.2),
        # Note: We must match the number of classes. 
        # If you know the exact number (e.g. 3), put it here. 
        # Otherwise, the load_weights might complain if shapes mismatch.
        # For Potato Disease, it's usually 3 (Early, Late, Healthy).
        layers.Dense(3, activation='softmax') 
    ])
    return model

# --- 2. CONFIGURATION ---
MODEL_PATH = "models/fast_disease_model.h5"
TEST_IMAGE = "test_leaf.jpg"
OUTPUT_IMAGE = "gradcam_result.png"

def run_test():
    # Force CPU to avoid VRAM crashes during debug
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'

    if not os.path.exists(MODEL_PATH):
        print(f"❌ Error: Model file not found at {MODEL_PATH}")
        return

    try:
        # A. Build the empty shell
        model = build_model_locally()
        
        # B. Load ONLY the weights (Bypasses the architecture version conflict)
        print(f"⚖️ Loading weights from {MODEL_PATH}...")
        model.load_weights(MODEL_PATH)
        print("✅ Model loaded successfully (Weights only mode).")
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        print("Tip: If the error is about 'shape mismatch', the number of Dense neurons (3) in build_model_locally() might be wrong for your dataset.")
        return

    # C. Run Grad-CAM
    print(f"🔎 Generating Grad-CAM for {TEST_IMAGE}...")
    success = generate_and_save_gradcam(
        img_path=TEST_IMAGE,
        output_path=OUTPUT_IMAGE,
        model=model,
        layer_name="out_relu",
        alpha=0.5
    )

    if success:
        print(f"✅ Success! Heatmap saved to: {OUTPUT_IMAGE}")
    else:
        print("❌ Grad-CAM generation failed.")

if __name__ == "__main__":
    run_test()