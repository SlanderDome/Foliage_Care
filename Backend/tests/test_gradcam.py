from google import genai

# Initialize client
client = genai.Client(api_key="AIzaSyB-TW2N6_tVPeHnhZl9C-3BAGNXdWsJEb8")

# List models
models = client.models.list()
for model in models:
    print(model.name)