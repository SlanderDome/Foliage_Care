import tensorflow as tf
import cv2
import numpy as np
import base64
import requests
import os
from io import BytesIO
from PIL import Image
from utils.gradcam import get_gradcam, generate_diagnosis_image, save_gradcam_visualization

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(BASE_DIR, "models", "disease_weights.weights.h5")

# Disease class names (update with your actual classes)
CLASS_NAMES = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 
    'Cherry_(including_sour)___healthy', 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn_(maize)___Common_rust_', 'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy',
    'Grape___Black_rot', 'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy', 'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot',
    'Peach___healthy', 'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy',
    'Potato___Early_blight', 'Potato___Late_blight'
]

# --- MODEL BUILDER ---
def build_disease_model():
    """Build the disease detection model architecture"""
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
        tf.keras.layers.Dense(len(CLASS_NAMES), activation='softmax')
    ])
    
    model.build((None, 224, 224, 3))
    return model


def test_with_url():
    """Test Grad-CAM with an image from URL"""
    print("=" * 60)
    print("🧪 TESTING GRAD-CAM WITH URL IMAGE")
    print("=" * 60)
    
    # 1. Load Model
    if not os.path.exists(WEIGHTS_PATH):
        print(f"❌ Weights file not found: {WEIGHTS_PATH}")
        print("Please ensure your trained model weights are in the 'models' folder")
        return
    
    print("📦 Loading model...")
    model = build_disease_model()
    model.load_weights(WEIGHTS_PATH)
    print("✅ Model loaded successfully")
    
    # Debug: Print available conv layer names
    print("\n🔍 Available convolutional layers:")
    base_model = model.layers[0]
    conv_layers = [l.name for l in base_model.layers if 'conv' in l.name.lower() or 'block' in l.name.lower()]
    for i, name in enumerate(conv_layers[-10:]):  # Show last 10
        print(f"   {i+1}. {name}")
    print()
    
    # 2. Download test image
    print("\n📥 Downloading test image...")
    url = "https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Potato___Early_blight/001187a0-57ab-4329-baff-e7246a9edeb0___RS_Early.B%208178.JPG"
    
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        img_pil = Image.open(BytesIO(resp.content)).convert("RGB")
        img_np = np.array(img_pil.resize((224, 224)))
        print("✅ Image downloaded")
    except Exception as e:
        print(f"❌ Error downloading image: {e}")
        return
    
    # 3. Preprocess and predict
    print("\n🧠 Running inference...")
    img_batch = np.expand_dims(img_np, axis=0) / 255.0
    preds = model.predict(img_batch, verbose=0)
    
    class_idx = int(np.argmax(preds[0]))
    confidence = float(np.max(preds[0])) * 100
    class_name = CLASS_NAMES[class_idx] if class_idx < len(CLASS_NAMES) else f"Class {class_idx}"
    
    print(f"✅ Prediction: {class_name}")
    print(f"✅ Confidence: {confidence:.2f}%")
    
    # 4. Generate Grad-CAM
    print("\n🔥 Generating Grad-CAM heatmap...")
    try:
        # First, try auto-detection (None)
        print("   Attempting auto-detection...")
        heatmap = get_gradcam(model, img_batch, class_idx, last_conv_layer=None)
        print(f"✅ Grad-CAM generated successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n🔍 Debugging - checking model structure...")
        
        # Print base model info
        base_model = model.layers[0]
        conv_layers = [l for l in base_model.layers 
                      if isinstance(l, (tf.keras.layers.Conv2D, tf.keras.layers.DepthwiseConv2D))]
        
        print(f"   Base model has {len(base_model.layers)} layers")
        print(f"   Found {len(conv_layers)} convolutional layers")
        
        if conv_layers:
            print(f"   Last 5 conv layers:")
            for layer in conv_layers[-5:]:
                print(f"      - {layer.name}")
        
        import traceback
        traceback.print_exc()
        return
        
        if heatmap is None:
            raise ValueError("Could not generate heatmap with any layer")
        
    except Exception as e:
        print(f"❌ Error generating Grad-CAM: {e}")
        return
    
    # 5. Create visualization
    print("\n🎨 Creating visualization...")
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    base64_str = generate_diagnosis_image(img_bgr, heatmap, class_name, confidence)
    
    # 6. Save output
    output_path = os.path.join(BASE_DIR, "gradcam_output.png")
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(base64_str))
    
    print(f"✅ Saved visualization: {output_path}")
    print("\n" + "=" * 60)
    print("✨ Test completed successfully!")
    print("=" * 60)


def test_with_local_image(image_path):
    """Test Grad-CAM with a local image file"""
    print("=" * 60)
    print(f"🧪 TESTING GRAD-CAM WITH LOCAL IMAGE")
    print("=" * 60)
    
    # Load model
    if not os.path.exists(WEIGHTS_PATH):
        print(f"❌ Weights file not found: {WEIGHTS_PATH}")
        return
    
    print("📦 Loading model...")
    model = build_disease_model()
    model.load_weights(WEIGHTS_PATH)
    print("✅ Model loaded")
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}")
        return
    
    print(f"\n📸 Processing: {image_path}")
    
    try:
        # Use the complete pipeline
        results = save_gradcam_visualization(image_path, model, CLASS_NAMES)
        
        print(f"\n✅ Prediction: {results['class_name']}")
        print(f"✅ Confidence: {results['confidence']:.2f}%")
        
        # Save output
        output_path = os.path.join(BASE_DIR, "gradcam_local_output.png")
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(results['gradcam_base64']))
        
        print(f"✅ Saved: {output_path}")
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def test_multiple_layers():
    """Compare different conv layers for Grad-CAM quality"""
    print("=" * 60)
    print("🔬 TESTING DIFFERENT CONV LAYERS")
    print("=" * 60)
    
    # Load model
    if not os.path.exists(WEIGHTS_PATH):
        print(f"❌ Weights file not found")
        return
    
    model = build_disease_model()
    model.load_weights(WEIGHTS_PATH)
    
    # Get test image
    url = "https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Potato___Early_blight/001187a0-57ab-4329-baff-e7246a9edeb0___RS_Early.B%208178.JPG"
    resp = requests.get(url)
    img_np = np.array(Image.open(BytesIO(resp.content)).convert("RGB").resize((224, 224)))
    img_batch = np.expand_dims(img_np, axis=0) / 255.0
    
    # Predict
    preds = model.predict(img_batch, verbose=0)
    class_idx = int(np.argmax(preds[0]))
    confidence = float(np.max(preds[0])) * 100
    class_name = CLASS_NAMES[class_idx]
    
    # Test different layers
    layers_to_test = [
        "block_16_project",
        "block_15_project", 
        "block_14_project",
        "Conv_1"
    ]
    
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    
    for layer_name in layers_to_test:
        try:
            print(f"\n🔍 Testing layer: {layer_name}")
            heatmap = get_gradcam(model, img_batch, class_idx, last_conv_layer=layer_name)
            base64_str = generate_diagnosis_image(img_bgr, heatmap, class_name, confidence)
            
            output_path = f"gradcam_{layer_name}.png"
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(base64_str))
            
            print(f"✅ Saved: {output_path}")
            
        except Exception as e:
            print(f"❌ Failed: {e}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    import sys
    
    print("\n🌾 CROP DISEASE GRAD-CAM TESTER 🌾\n")
    
    if len(sys.argv) > 1:
        # Test with local image if path provided
        test_with_local_image(sys.argv[1])
    else:
        # Test with URL image
        test_with_url()
        
        # Uncomment to test multiple layers
        # test_multiple_layers()
    
    print("\n💡 TIP: Run with image path as argument to test local images")
    print("   Example: python test_gradcam.py path/to/leaf.jpg\n")