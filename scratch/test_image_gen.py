from google import genai
from google.genai import types
import os

def test_image_gen():
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    model_id = "imagen-4.0-generate-001"
    prompt = "A majestic dragon guarding a treasure hoard, detailed fantasy illustration, cinematic lighting"
    
    print(f"Attempting to generate image with model: {model_id}")
    try:
        response = client.models.generate_images(
            model=model_id,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
            )
        )
        
        if response.generated_images:
            img = response.generated_images[0]
            # Inspect the image object
            print(f"Success! Image generated.")
            # Depending on SDK version, it might be image_bytes or similar
            # Check for attributes
            if hasattr(img.image, 'image_bytes'):
                print(f"Image bytes size: {len(img.image.image_bytes)}")
            elif hasattr(img.image, 'data'):
                 print(f"Image data size: {len(img.image.data)}")
            else:
                print(f"Image object attributes: {dir(img.image)}")
        else:
            print("No images generated.")
            
    except Exception as e:
        print(f"Generation failed: {e}")

if __name__ == "__main__":
    test_image_gen()
