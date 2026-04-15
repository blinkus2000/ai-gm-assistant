from google import genai
import os

def list_models():
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    print("Listing models...")
    for model in client.models.list():
        # Using model_dump() since it's a Pydantic model
        m = model.model_dump()
        print(f"Model: {m.get('name')} | Supported Methods: {m.get('supported_generation_methods')}")

if __name__ == "__main__":
    list_models()
