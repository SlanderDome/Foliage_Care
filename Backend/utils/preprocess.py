import cv2
import numpy as np

def preprocess_image(img_bgr):
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_rgb = cv2.resize(img_rgb, (224, 224))
    img_rgb = img_rgb / 255.0
    img_rgb = np.expand_dims(img_rgb, axis=0)
    return img_rgb
