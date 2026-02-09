import os
import sys

print("=" * 50)
print("DEBUG: Current Working Directory")
print("=" * 50)
print(f"Current directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
print(f"Script directory: {script_dir}")

# Models should be in Backend/models/
models_dir = os.path.join(script_dir, "models")
print(f"Looking for models in: {models_dir}")

print("\n" + "=" * 50)
print("CHECKING IF MODELS FOLDER EXISTS")
print("=" * 50)

if os.path.exists(models_dir):
    print(f"✅ Found models directory: {models_dir}")
else:
    print(f"❌ Models directory NOT FOUND: {models_dir}")
    print("\nSearching for .h5 files in Backend directory...")
    
    # Search in Backend directory
    backend_files = os.listdir(script_dir)
    h5_files = [f for f in backend_files if f.endswith('.h5')]
    
    if h5_files:
        print(f"\n✅ Found {len(h5_files)} .h5 files in Backend directory:")
        for f in h5_files:
            size = os.path.getsize(os.path.join(script_dir, f)) / (1024 * 1024)
            print(f"   📦 {f} - {size:.2f} MB")
        
        models_dir = script_dir  # Update models_dir to Backend directory
    else:
        print("\n❌ No .h5 files found in Backend directory")
        print("\nPlease check:")
        print("1. Are your model files in Backend/models/ ?")
        print("2. Or are they directly in Backend/ ?")
        sys.exit(1)

print("\n" + "=" * 50)
print("MODEL FILES")
print("=" * 50)

for file in os.listdir(models_dir):
    if file.endswith(('.h5', '.keras')):
        filepath = os.path.join(models_dir, file)
        size = os.path.getsize(filepath) / (1024 * 1024)  # MB
        print(f"📦 {file}")
        print(f"   Size: {size:.2f} MB")
        print(f"   Path: {filepath}")
        print()

print("=" * 50)
print("WHICH MODELS TO USE?")
print("=" * 50)
print("Based on your file structure, we need:")
print("1. Plant Checker: new_plant_detector.h5")
print("2. Disease Detector: fast_disease_model.h5")
print("\nLet me know if these files are named differently!")