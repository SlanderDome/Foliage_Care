import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, Input

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from utils.gradcam import make_gradcam_heatmap, save_gradcam

# --- CONFIGURATION ---
# 1. Try to use the .keras file first (It is more compatible with Keras 3)
# Note: Check your filename closely in VS Code. Your screenshot showed a space: "new_disease_model .keras"
MODEL_FILENAME = 'new_disease_model.keras' 
MODEL_PATH = os.path.join(parent_dir, 'models', MODEL_FILENAME)

# Fallback to .h5 if .keras doesn't exist
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(parent_dir, 'models', 'new_disease_model.h5')

IMAGE_PATH = os.path.join(current_dir, 'test_input_leaf.jpg')
OUTPUT_PATH = os.path.join(parent_dir, 'gradcam_output.png')

def build_functional_model():
    """
    Rebuilds the model using the Functional API.
    This fixes the 'Dense layer received 2 inputs' error and shape mismatches.
    """
    print("Building model using Functional API...")
    
    # 1. Define Input explicitly
    inputs = Input(shape=(224, 224, 3))
    
    # 2. Load Base Model
    # Note: We call it with `inputs` immediately to bind it correctly
    base_model = tf.keras.applications.MobileNetV2(
        weights=None, 
        include_top=False, 
        input_tensor=inputs
    )
    
    # 3. Reconstruct the head
    x = base_model.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    outputs = layers.Dense(22, activation='softmax')(x)
    
    model = models.Model(inputs=inputs, outputs=outputs)
    return model

def run_test():
    if not os.path.exists(MODEL_PATH):
        print(f"Error: Model not found at {MODEL_PATH}")
        print("Check if the file is named 'new_disease_model .keras' (with a space) or just 'new_disease_model.keras'")
        return

    print(f"Attempting to load: {MODEL_PATH}")

    try:
        # STRATEGY 1: Try loading the full model directly (Best for .keras)
        model = tf.keras.models.load_model(MODEL_PATH)
        print("Model loaded successfully with load_model().")
        
    except Exception as e_load:
        print(f"\nDirect load failed ({e_load}). \nAttempting to rebuild architecture and load weights...")
        
        try:
            # STRATEGY 2: Manual Rebuild + Load Weights (Best for .h5 legacy)
            model = build_functional_model()
            
            # Load weights by name to avoid topological mismatch
            # 'by_name=True' and 'skip_mismatch=True' are life-savers here
            model.load_weights(MODEL_PATH, by_name=True, skip_mismatch=True)
            print("Model weights loaded successfully (with mismatch skipping).")
            
        except Exception as e_build:
            print(f"CRITICAL ERROR: Could not load model. Reason: {e_build}")
            return

    # --- IMAGE PREPROCESSING ---
    if not os.path.exists(IMAGE_PATH):
        print(f"Error: Test image not found at {IMAGE_PATH}")
        return

    print("Preprocessing image...")
    img_size = (224, 224)
    img = tf.keras.preprocessing.image.load_img(IMAGE_PATH, target_size=img_size)
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = img_array / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    # --- GRAD-CAM ---
    print("Generating heatmap...")
    
    # We need to find the last convolutional layer. 
    # In MobileNetV2, it is usually "Conv_1" or "out_relu".
    # Since we might have wrapped it, we look inside.
    
    target_layer = "out_relu"
    
    try:
        heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name=target_layer)
        save_gradcam(IMAGE_PATH, heatmap, output_path=OUTPUT_PATH)
    except Exception as e:
        print(f"Standard layer search failed: {e}")
        print("Attempting deep search for target layer...")
        
        # Fallback: if the model is wrapped, digging 1 level deeper is handled by your utils script,
        # but if names are different, we try 'Conv_1' which is common in Keras 3 MobileNet.
        try:
             heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name="Conv_1")
             save_gradcam(IMAGE_PATH, heatmap, output_path=OUTPUT_PATH)
        except Exception as final_e:
             print(f"Could not generate heatmap. Error: {final_e}")

if __name__ == "__main__":
    run_test()