import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import os
import gc

# CRITICAL: Use 'Agg' backend to prevent crashes on servers/local terminals
plt.switch_backend('Agg')

def get_gradcam_heatmap(img_array, model, last_conv_layer_name):
    """Core logic to generate the heatmap array (Internal function)"""
    base_model = model.layers[0]
    
    try:
        target_layer = base_model.get_layer(last_conv_layer_name)
    except ValueError:
        # Fallback: sometimes the layer is in the main model, not the nested base
        try:
            target_layer = model.get_layer(last_conv_layer_name)
        except ValueError:
            print(f"Layer {last_conv_layer_name} not found!")
            return None

    grad_model = tf.keras.models.Model(
        inputs=base_model.inputs if hasattr(base_model, 'inputs') else model.inputs,
        outputs=[target_layer.output, base_model.output if hasattr(base_model, 'output') else model.output]
    )

    with tf.GradientTape() as tape:
        conv_output, base_output = grad_model(img_array)
        tape.watch(conv_output)
        
        # Forward pass through remaining layers
        preds = base_output
        classifier_layers = model.layers[1:] # Adjust if your architecture differs
        for layer in classifier_layers:
            preds = layer(preds)
            
        top_class_channel = preds[:, tf.argmax(preds[0])]

    grads = tape.gradient(top_class_channel, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_output = conv_output[0]
    heatmap = conv_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    
    return heatmap.numpy()

def generate_and_save_gradcam(img_path, output_path, model, layer_name="out_relu", alpha=0.4):
    """
    Main handler to call from your Backend.
    Saves the image to disk and returns True if successful.
    """
    try:
        # 1. Preprocess Image (Ensure this matches your training!)
        # Using standard ResNet/MobileNet logic:
        original_img = tf.keras.preprocessing.image.load_img(img_path, target_size=(224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(original_img)
        img_array = np.expand_dims(img_array, axis=0)
        # Note: Switch this to tf.keras.applications.resnet.preprocess_input if using ResNet
        img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)

        # 2. Generate Heatmap
        heatmap = get_gradcam_heatmap(img_array, model, layer_name)
        if heatmap is None: return False

        # 3. Create Visualization (No plt.show)
        heatmap = np.uint8(255 * heatmap)
        jet = cm.get_cmap("jet")
        jet_colors = jet(np.arange(256))[:, :3]
        jet_heatmap = jet_colors[heatmap]

        jet_heatmap = tf.keras.preprocessing.image.array_to_img(jet_heatmap)
        jet_heatmap = jet_heatmap.resize((original_img.width, original_img.height))
        jet_heatmap = tf.keras.preprocessing.image.img_to_array(jet_heatmap)

        # Load original for overlay
        load_original = tf.keras.preprocessing.image.load_img(img_path)
        load_original = tf.keras.preprocessing.image.img_to_array(load_original)

        superimposed_img = jet_heatmap * alpha + load_original * (1 - alpha)
        superimposed_img = np.clip(superimposed_img, 0, 255).astype(np.uint8)
        
        # 4. Save to Disk
        final_img = tf.keras.preprocessing.image.array_to_img(superimposed_img)
        final_img.save(output_path)
        
        return True

    except Exception as e:
        print(f"GradCAM Error: {e}")
        return False
    finally:
        # 5. Memory Cleanup (Crucial for local servers)
        gc.collect()