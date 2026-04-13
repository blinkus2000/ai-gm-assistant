import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from src.server import app
from src import storage

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
