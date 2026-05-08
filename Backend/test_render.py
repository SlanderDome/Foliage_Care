import requests
import io
from PIL import Image

BASE_URL = "https://foliage-care-backend.onrender.com"

# Create a tiny 100x100 green leaf image as test
img = Image.new("RGB", (100, 100), color=(34, 139, 34))
buf = io.BytesIO()
img.save(buf, format="JPEG")
buf.seek(0)

print("Sending test request to /predict ...")
try:
    r = requests.post(
        f"{BASE_URL}/predict",
        files={"file": ("test.jpg", buf, "image/jpeg")},
        data={"user_name": "TestUser", "user_type": "home_gardener"},
        timeout=60,
    )
    print(f"Status: {r.status_code}")
    print(f"Body:   {r.text[:800]}")
except Exception as e:
    print(f"Request failed: {e}")
