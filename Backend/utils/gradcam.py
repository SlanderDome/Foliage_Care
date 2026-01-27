import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import os
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input
from tensorflow.keras import layers, models

# --- 1. DEFINE THE MODEL ARCHITECTURE ---
# We must rebuild the empty shell of the model exactly as it was trained
def build_model_for_inference(num_classes=3): # Default to 3, but it adjusts below
    base_model = MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights=None # We don't need to download imagenet weights, we will load yours
    )
    base_model.trainable = False 

    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.2),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    # Build the graph so it's ready to receive weights
    model.build((None, 224, 224, 3))
    return model

# --- 2. GRAD-CAM FUNCTION ---
def get_gradcam_heatmap(img_array, model, last_conv_layer_name="out_relu"):
    base_model = model.layers[0] 
    
    try:
        target_layer = base_model.get_layer(last_conv_layer_name)
    except ValueError:
        print(f"Layer {last_conv_layer_name} not found!")
        return None

    grad_model = tf.keras.models.Model(
        inputs=base_model.inputs,
        outputs=[target_layer.output, base_model.output]
    )

    with tf.GradientTape() as tape:
        conv_output, base_output = grad_model(img_array)
        tape.watch(conv_output)

        preds = base_output
        classifier_layers = model.layers[1:]
        for layer in classifier_layers:
            preds = layer(preds)

        top_class_channel = preds[:, tf.argmax(preds[0])]

    grads = tape.gradient(top_class_channel, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_output = conv_output[0]
    heatmap = conv_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0)
    
    if tf.math.reduce_max(heatmap) == 0:
        return heatmap.numpy()
        
    heatmap /= tf.math.reduce_max(heatmap)
    return heatmap.numpy()

def display_gradcam(img_path, heatmap):
    img = tf.keras.preprocessing.image.load_img(img_path)
    img = tf.keras.preprocessing.image.img_to_array(img)

    heatmap = np.uint8(255 * heatmap)
    jet = cm.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[heatmap]

    jet_heatmap = tf.keras.preprocessing.image.array_to_img(jet_heatmap)
    jet_heatmap = jet_heatmap.resize((img.shape[1], img.shape[0]))
    jet_heatmap = tf.keras.preprocessing.image.img_to_array(jet_heatmap)

    superimposed_img = jet_heatmap * 0.5 + img 
    superimposed_img = tf.keras.preprocessing.image.array_to_img(superimposed_img)

    plt.figure(figsize=(10, 5))
    plt.subplot(1, 2, 1)
    plt.imshow(tf.keras.preprocessing.image.load_img(img_path))
    plt.title("Original")
    plt.axis("off")

    plt.subplot(1, 2, 2)
    plt.imshow(superimposed_img)
    plt.title("Corrected Grad-CAM")
    plt.axis("off")
    plt.show()

# --- 3. MAIN EXECUTION ---
if __name__ == "__main__":
    # Path to your weights
    model_path = r"E:\Foliage_Care\Backend\models\fast_disease_model.h5"
    
    # Path to your test image
    test_img_path = r"E:\Foliage_Care\Backend\tests\test_input_leaf.jpg" # <--- CHECK THIS PATH

    if os.path.exists(model_path) and os.path.exists(test_img_path):
        print("✅ Found model and image.")
        
        # 1. Initialize empty model (You have 3 classes: Early, Healthy, Late)
        model = build_model_for_inference(num_classes=3)
        
        # 2. Load weights ONLY (Bypasses the architecture error)
        print("Loading weights...")
        try:
            model.load_weights(model_path)
            print("✅ Weights loaded successfully.")
        except Exception as e:
            print(f"❌ Weight loading failed: {e}")
            exit()

        # 3. Process Image
        img = tf.keras.preprocessing.image.load_img(test_img_path, target_size=(224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)

        # 4. Run Grad-CAM
        print("Generating Heatmap...")
        heatmap = get_gradcam_heatmap(img_array, model, last_conv_layer_name="out_relu")
        
        if heatmap is not None:
            display_gradcam(test_img_path, heatmap)
    else:
        print(f"❌ Check paths:\nModel: {model_path}\nImage: {test_img_path}")