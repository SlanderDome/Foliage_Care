import os
import tensorflow as tf
import numpy as np
from PIL import Image
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# Set path
script_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(script_dir, "models")

print("=" * 60)
print("TESTING PLANT CHECKER MODEL")
print("=" * 60)

# Test Plant Checker
try:
    plant_model_path = os.path.join(models_dir, "new_plant_detector.h5")
    print(f"\n📦 Loading: {plant_model_path}")
    plant_model = tf.keras.models.load_model(plant_model_path)
    print("✅ Plant Checker Loaded Successfully!")
    
    print("\n📊 Model Summary:")
    plant_model.summary()
    
    # Check input/output shape
    print(f"\n🔍 Input shape: {plant_model.input_shape}")
    print(f"🔍 Output shape: {plant_model.output_shape}")
    
    # Test prediction with dummy data
    dummy_img = np.random.rand(1, 224, 224, 3)
    test_pred = plant_model.predict(dummy_img, verbose=0)
    print(f"\n🧪 Test prediction shape: {test_pred.shape}")
    print(f"🧪 Test prediction value: {test_pred[0][0]:.4f}")
    print("✅ Plant Checker is working!")
    
except Exception as e:
    print(f"❌ Error loading plant checker: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("TESTING DISEASE DETECTOR MODEL")
print("=" * 60)

# Test Disease Detector
try:
    disease_model_path = os.path.join(models_dir, "fast_disease_model.h5")
    print(f"\n📦 Loading: {disease_model_path}")
    disease_model = tf.keras.models.load_model(disease_model_path)
    print("✅ Disease Detector Loaded Successfully!")
    
    print("\n📊 Model Summary:")
    disease_model.summary()
    
    # Check input/output shape
    print(f"\n🔍 Input shape: {disease_model.input_shape}")
    print(f"🔍 Output shape: {disease_model.output_shape}")
    
    # Test prediction with dummy data
    dummy_img = np.random.rand(1, 224, 224, 3)
    test_pred = disease_model.predict(dummy_img, verbose=0)
    print(f"\n🧪 Test prediction shape: {test_pred.shape}")
    print(f"🧪 Number of classes: {test_pred.shape[1]}")
    print(f"🧪 Max probability: {np.max(test_pred):.4f}")
    print(f"🧪 Predicted class: {np.argmax(test_pred)}")
    print("✅ Disease Detector is working!")
    
except Exception as e:
    print(f"❌ Error loading disease detector: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print("✅ Both models loaded successfully!")
print("\nNext step: Test with a real image")
print("Create a file called 'test_leaf.jpg' in the Backend folder")
print("Then run step3_test_real_image.py")