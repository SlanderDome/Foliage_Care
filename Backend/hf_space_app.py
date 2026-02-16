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
    Uses percentile-based normalization for better contrast.
    """
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_cam_model(img_tensor)
        tape.watch(conv_outputs)
        class_score = predictions[:, pred_index]

    grads = tape.gradient(class_score, conv_outputs)

    if grads is None:
        print("⚠️ Grad-CAM: gradients are None, returning blank heatmap")
        return np.zeros(conv_outputs.shape[1:3], dtype=np.float32)

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    # ReLU — only positive contributions
    heatmap = tf.maximum(heatmap, 0)
    heatmap_np = heatmap.numpy()

    # Percentile-based normalization for better contrast
    # Prevents one bright pixel from washing out the rest
    if heatmap_np.max() > 0:
        p95 = np.percentile(heatmap_np, 95)
        if p95 > 0:
            heatmap_np = np.clip(heatmap_np, 0, p95) / p95
        else:
            heatmap_np = heatmap_np / heatmap_np.max()

    return heatmap_np


def _smooth_heatmap(heatmap, kernel_size=3):
    """Apply simple box-blur smoothing to remove blocky artifacts (no scipy needed)."""
    pad = kernel_size // 2
    padded = np.pad(heatmap, pad, mode='reflect')
    kernel = np.ones((kernel_size, kernel_size)) / (kernel_size ** 2)
    h, w = heatmap.shape
    smoothed = np.zeros_like(heatmap)
    for i in range(h):
        for j in range(w):
            smoothed[i, j] = np.sum(padded[i:i+kernel_size, j:j+kernel_size] * kernel)
    return smoothed

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

        # Smooth the raw heatmap (typically 7×7) before upscaling
        heatmap = _smooth_heatmap(heatmap, kernel_size=3)

        colored_heatmap = apply_jet_colormap(heatmap)
        colored_heatmap = Image.fromarray(colored_heatmap)
        colored_heatmap = colored_heatmap.resize(
            original_img.size, resample=Image.LANCZOS
        )

        # Intensity-weighted alpha: only overlay where activation exists
        heatmap_upscaled = np.array(
            Image.fromarray(np.uint8(heatmap * 255)).resize(
                original_img.size, resample=Image.LANCZOS
            )
        ).astype(np.float32) / 255.0

        # Alpha ranges from 0.0 (no activation) to 0.55 (strong activation)
        alpha_mask = np.expand_dims(heatmap_upscaled * 0.55, axis=-1)
        orig_np = np.array(original_img).astype(np.float32)
        heat_np = np.array(colored_heatmap).astype(np.float32)

        blended = orig_np * (1 - alpha_mask) + heat_np * alpha_mask
        final_image = Image.fromarray(np.uint8(np.clip(blended, 0, 255)))

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
