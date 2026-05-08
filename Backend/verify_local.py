import os
from dotenv import load_dotenv
from google import genai

# Load the .env file from the same directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Available Gemini Models:")
for m in client.models.list():
    if "gemini" in m.name.lower():
        print(f"- {m.name} ({m.description})")