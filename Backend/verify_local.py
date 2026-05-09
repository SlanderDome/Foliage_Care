from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
models = client.models.list()

for model in models.data:
    print(f"- {model.id} (owned by {model.owned_by})")