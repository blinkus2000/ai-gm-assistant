import pytest
from fastapi.testclient import TestClient

def test_generate_session(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    req = {"prompt": "Generate a tavern session"}
    resp = client.post(f"/api/campaigns/{campaign_id}/generate/session", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert "mock_title" in data.values() or "title" in data

def test_generate_npc(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    req = {"prompt": "A shadowy rogue", "role": "villain"}
    resp = client.post(f"/api/campaigns/{campaign_id}/generate/npc", json=req)
    assert resp.status_code == 200

def test_enhance_npc(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    npc_r = client.post(f"/api/campaigns/{campaign_id}/npcs", json={"name": "Bob"})
    npc_id = npc_r.json()["npc_id"]

    req = {"prompt": "Make him scary"}
    resp = client.post(f"/api/campaigns/{campaign_id}/npcs/{npc_id}/enhance", json=req)
    assert resp.status_code == 200

    # Ensure NPC updated
    c_resp = client.get(f"/api/campaigns/{campaign_id}")
    npc = next(n for n in c_resp.json()["npcs"] if n["id"] == npc_id)
    assert npc["description"] is not None

def test_generate_image(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    npc_r = client.post(f"/api/campaigns/{campaign_id}/npcs", json={"name": "Bob"})
    npc_id = npc_r.json()["npc_id"]

    resp = client.post(f"/api/campaigns/{campaign_id}/npcs/{npc_id}/generate-image")
    assert resp.status_code == 200
    assert "image_path" in resp.json()
    assert resp.json()["image_path"].startswith("/images")

def test_generate_adversary(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    req = {"prompt": "A big boss", "adventure_type": "thwarting", "adversary_type": "heavy_hitter"}
    resp = client.post(f"/api/campaigns/{campaign_id}/generate/adversary", json=req)
    assert resp.status_code == 200
    assert "steps" in resp.json()

def test_generate_encounter(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    req = {"prompt": "Goblin ambush", "party_level": 1, "party_size": 4}
    resp = client.post(f"/api/campaigns/{campaign_id}/generate/encounter", json=req)
    assert resp.status_code == 200

def test_generate_module(client: TestClient):
    create_resp = client.post("/api/campaigns", json={"name": "Test Campaign AI"})
    campaign_id = create_resp.json()["id"]

    req = {"prompt": "Test module"}
    resp = client.post(f"/api/campaigns/{campaign_id}/modules/generate", json=req)
    assert resp.status_code == 200
    assert "pdf_filename" in resp.json()
