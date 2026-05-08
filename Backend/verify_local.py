import os
from openai import OpenAI
from dotenv import load_dotenv

# Load your .env file
load_dotenv() 

# Initialize the client
client = OpenAI(api_key=os.getenv("OPEN_API_KEY"))

# Fetch the list of models
models = client.models.list()

# Print the ID of every available model
print("Available OpenAI Models:")
for model in models.data:
    print(f"- {model.id}")