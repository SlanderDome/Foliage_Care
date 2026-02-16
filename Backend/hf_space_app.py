# ================================
# Hugging Face Space - app.py
# Foliage Care | Crop Disease Detection + Grad-CAM
# ================================

import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import gc
import gradio as gr
import tensorflow as tf
import numpy as np
from PIL import Image

# ================================
# CONFIG
# ================================
MODEL_PATH = "fast_disease_model.h5"
NUM_CLASSES = 22
IMAGE_SIZE = (224, 224)

# Class names (from class_indices.json)
CLASS_NAMES = {
    0: "Apple — Apple Scab",
    1: "Apple — Black Rot",
    2: "Apple — Cedar Apple Rust",
    3: "Apple — Healthy",
    4: "Cherry — Powdery Mildew",
    5: "Cherry — Healthy",
    6: "Corn — Cercospora / Gray Leaf Spot",
    7: "Corn — Common Rust",
    8: "Corn — Northern Leaf Blight",
    9: "Corn — Healthy",
    10: "Grape — Black Rot",
    11: "Grape — Esca (Black Measles)",
    12: "Grape — Leaf Blight (Isariopsis)",
    13: "Grape — Healthy",
    14: "Orange — Huanglongbing (Citrus Greening)",
    15: "Peach — Bacterial Spot",
    16: "Peach — Healthy",
    17: "Pepper Bell — Bacterial Spot",
    18: "Pepper Bell — Healthy",
    19: "Potato — Early Blight",
    20: "Potato — Late Blight",
    21: "Potato — Healthy",
}

# ================================
# LOAD MODEL + GRAD-CAM MODEL
# ================================
def load_resources():
    print("🏗️ Loading model...")
    try:
        model = tf.keras.models.load_model(MODEL_PATH)

        # Auto-detect the last conv layer
        # For Sequential models: layers[0] is the MobileNetV2 base
        base_model = model.layers[0]

        try:
            target_layer = base_model.get_layer("out_relu")
            layer_name = "out_relu"
        except ValueError:
            target_layer = base_model.get_layer("Conv_1")
            layer_name = "Conv_1"

        # Build Grad-CAM model using the FULL model's input
        # This avoids creating a duplicate input tensor
        grad_model = tf.keras.models.Model(
            inputs=model.input,
            outputs=[target_layer.output, model.output],
        )

        print(f"✅ Model loaded. Grad-CAM layer: {layer_name}")
        return model, grad_model

    except Exception as e:
        print(f"❌ Model load failed: {e}")
        return None, None


main_model, grad_cam_model = load_resources()

# ================================
# JET COLORMAP (256-entry LUT)
# ================================
def _build_jet_lut():
    """Pre-compute a 256×3 Jet colormap lookup table (pure NumPy)."""
    t = np.linspace(0, 1, 256)
    r = np.clip(1.5 - np.abs(t - 0.75) * 4, 0, 1)
    g = np.clip(1.5 - np.abs(t - 0.50) * 4, 0, 1)
    b = np.clip(1.5 - np.abs(t - 0.25) * 4, 0, 1)
    return np.stack([r, g, b], axis=-1)  # (256, 3) float 0-1

JET_LUT = _build_jet_lut()


def apply_jet_colormap(heatmap):
    """Convert a 0-1 float heatmap to an RGB image using the Jet colormap."""
    indices = np.uint8(np.clip(heatmap, 0, 1) * 255)
    colored = JET_LUT[indices]  # (H, W, 3) float 0-1
    return (colored * 255).astype(np.uint8)

# ================================
# GRAD-CAM HEATMAP GENERATION
# ================================
def generate_gradcam_heatmap(img_array, pred_index):
    """
    Generates a Grad-CAM heatmap for the given class index.
    The grad_cam_model outputs [conv_layer_output, final_predictions]
    from a single forward pass through the full model.
    """
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        # Single forward pass through the full model
        conv_outputs, predictions = grad_cam_model(img_tensor)
        tape.watch(conv_outputs)
        class_score = predictions[:, pred_index]

    # Compute gradients of class score w.r.t. conv outputs
    grads = tape.gradient(class_score, conv_outputs)

    if grads is None:
        print("⚠️ Grad-CAM: gradients are None, returning blank heatmap")
        return np.zeros(conv_outputs.shape[1:3], dtype=np.float32)

    # Global average pooling of gradients → channel importance weights
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    # Weighted combination of feature maps
    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    # ReLU + normalize to 0-1
    heatmap = tf.maximum(heatmap, 0)
    max_val = tf.reduce_max(heatmap)
    if max_val > 0:
        heatmap = heatmap / max_val

    return heatmap.numpy()

# ================================
# PREDICTION + GRAD-CAM OVERLAY
# ================================
def process_image(input_image):
    try:
        if main_model is None:
            return "❌ Model failed to load.", input_image

        # --- Preprocess (match training: /255.0) ---
        original_img = input_image.convert("RGB")
        resized_img = original_img.resize(IMAGE_SIZE)

        img_array = np.array(resized_img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        # --- Prediction ---
        preds = main_model.predict(img_array, verbose=0)
        class_idx = int(np.argmax(preds[0]))
        confidence = float(preds[0][class_idx])

        class_name = CLASS_NAMES.get(class_idx, f"Class {class_idx}")
        result_text = (
            f"🌿 Diagnosis: {class_name}\n"
            f"📊 Confidence: {confidence:.2%}"
        )

        # --- Grad-CAM ---
        heatmap = generate_gradcam_heatmap(img_array, class_idx)

        colored_heatmap = apply_jet_colormap(heatmap)
        colored_heatmap = Image.fromarray(colored_heatmap)
        colored_heatmap = colored_heatmap.resize(
            original_img.size, resample=Image.BILINEAR
        )

        final_image = Image.blend(original_img, colored_heatmap, alpha=0.4)

        return result_text, final_image

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return f"Error: {e}", input_image
    finally:
        gc.collect()


# ================================
# GRADIO UI
# ================================
iface = gr.Interface(
    fn=process_image,
    inputs=gr.Image(type="pil", label="Upload Crop Image"),
    outputs=[
        gr.Textbox(label="Diagnosis"),
        gr.Image(label="Grad-CAM Heatmap"),
    ],
    title="🌿 Foliage Care",
    description="Crop Disease Detection using Deep Learning + Grad-CAM",
    flagging_mode="never",
)

iface.launch(
    server_name="0.0.0.0",
    server_port=7860,
    debug=False,
    share=False,
)
