import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient

from src.server import app
from src import storage
from src import gemini_client

class MockGeneratedImage:
    def __init__(self, image_bytes: bytes):
        self.image_bytes = image_bytes

class MockImageResponseData:
    def __init__(self, image_bytes: bytes):
        self.image = MockGeneratedImage(image_bytes)

class MockGenerateImagesResponse:
    def __init__(self, image_bytes: bytes):
        self.generated_images = [MockImageResponseData(image_bytes)]

class MockGenerateContentResponse:
    def __init__(self, text: str):
        self.text = text

class MockModels:
    def generate_content(self, model, contents, config=None):
        schema = None
        if config and hasattr(config, "response_json_schema") and config.response_json_schema:
            schema = config.response_json_schema
        elif config and hasattr(config, "system_instruction") and config.system_instruction:
            if "```json" in config.system_instruction:
                try:
                    s_str = config.system_instruction.split("```json")[1].split("```")[0]
                    schema = json.loads(s_str)
                except Exception:
                    pass
        
        def mock_from_schema(s, name="root", root_schema=None):
            if not root_schema: root_schema = s
            if "type" in s:
                t = s["type"]
                if t == "string": return "mock_" + name
                elif t == "integer": return 42
                elif t == "boolean": return True
                elif t == "array":
                    items_schema = s.get("items", {})
                    return [mock_from_schema(items_schema, name="item", root_schema=root_schema)]
                elif t == "object":
                    obj = {}
                    if "properties" in s:
                        for k, v in s["properties"].items():
                            obj[k] = mock_from_schema(v, name=k, root_schema=root_schema)
                    return obj
            elif "$ref" in s:
                ref_path = s["$ref"].split("/")[-1]
                if "$defs" in root_schema and ref_path in root_schema["$defs"]:
                    return mock_from_schema(root_schema["$defs"][ref_path], name=name, root_schema=root_schema)
                return "mock_ref"
            elif "anyOf" in s:
                return mock_from_schema(s["anyOf"][0], name=name, root_schema=root_schema)
            return None
                
        result = mock_from_schema(schema) if schema else {}
        return MockGenerateContentResponse(json.dumps(result))

    def generate_images(self, model, prompt, config=None):
        return MockGenerateImagesResponse(b"mock_image_bytes")

class MockClient:
    def __init__(self):
        self.models = MockModels()

@pytest.fixture(autouse=True)
def mock_gemini_client(monkeypatch: pytest.MonkeyPatch):
    """Mocks the get_client function to return a MockClient."""
    from src import generator
    monkeypatch.setattr(generator, "get_client", lambda: MockClient())


@pytest.fixture(autouse=True)
def mock_storage_dirs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """
    Automatically mock the storage directories so that tests
    do not interfere with actual campaign data.
    """
    data_dir = tmp_path / "data" / "campaigns"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(storage, "DATA_DIR", data_dir)
    
    # Also patch the helper directories
    # Since they compute relative to __file__ inside the functions, we can mock the functions
    original_get_rulesets = storage.get_campaign_rulesets_dir
    original_get_images = storage.get_images_dir
    
    def mocked_get_rulesets(campaign_id: str) -> Path:
        d = tmp_path / "data" / "rulesets" / campaign_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def mocked_get_images(campaign_id: str) -> Path:
        d = tmp_path / "data" / "images" / campaign_id
        d.mkdir(parents=True, exist_ok=True)
        return d
        
    monkeypatch.setattr(storage, "get_campaign_rulesets_dir", mocked_get_rulesets)
    monkeypatch.setattr(storage, "get_images_dir", mocked_get_images)
    
    return tmp_path

@pytest.fixture
def client():
    """Returns a FastAPI TestClient."""
    with TestClient(app) as c:
        yield c
