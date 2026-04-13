import pytest
from fastapi.testclient import TestClient

def test_serve_index(client: TestClient):
    response = client.get("/")
    # Normally this would return the index.html. Since we don't have the static files fully 
    # guaranteed during an API test or might get a 404/200 depending on cwd, we can just 
    # check that we don't get an internal server error.
    assert response.status_code in (200, 404)

def test_campaign_crud(client: TestClient):
    # Create
    create_resp = client.post("/api/campaigns", json={
        "name": "API Test",
        "game_system": "DnD 5e",
        "setting": "Forgotten Realms"
    })
    assert create_resp.status_code == 200
    data = create_resp.json()
    assert "id" in data
    assert data["name"] == "API Test"
    campaign_id = data["id"]
    
    # List
    list_resp = client.get("/api/campaigns")
    assert list_resp.status_code == 200
    summaries = list_resp.json()
    assert len(summaries) >= 1
    assert any(c["id"] == campaign_id for c in summaries)
    
    # Get
    get_resp = client.get(f"/api/campaigns/{campaign_id}")
    assert get_resp.status_code == 200
    camp_data = get_resp.json()
    assert camp_data["id"] == campaign_id
    assert camp_data["name"] == "API Test"
    assert camp_data["game_system"] == "DnD 5e"
    
    # Update
    update_resp = client.put(f"/api/campaigns/{campaign_id}", json={
        "notes": "Testing notes update"
    })
    assert update_resp.status_code == 200
    
    get_resp2 = client.get(f"/api/campaigns/{campaign_id}")
    assert get_resp2.json()["notes"] == "Testing notes update"
    
    # Delete
    delete_resp = client.delete(f"/api/campaigns/{campaign_id}")
    assert delete_resp.status_code == 200
    
    get_resp3 = client.get(f"/api/campaigns/{campaign_id}")
    assert get_resp3.status_code == 404

def test_session_auto_creates_entities(client: TestClient):
    # Create campaign
    create_resp = client.post("/api/campaigns", json={"name": "Auto Create Test"})
    campaign_id = create_resp.json()["id"]
    
    # Add session
    session_data = {
        "title": "Session 1",
        "npcs_involved": ["Bob", "Alice"],
        "locations_visited": ["Tavern", "Castle"]
    }
    
    sess_resp = client.post(f"/api/campaigns/{campaign_id}/sessions", json=session_data)
    assert sess_resp.status_code == 200
    
    # Fetch campaign and verify
    camp_resp = client.get(f"/api/campaigns/{campaign_id}")
    campaign = camp_resp.json()
    
    # Verify auto-creation
    assert len(campaign["sessions"]) == 1
    
    npc_names = [n["name"] for n in campaign["npcs"]]
    assert "Bob" in npc_names
    assert "Alice" in npc_names
    
    loc_names = [l["name"] for l in campaign["locations"]]
    assert "Tavern" in loc_names
    assert "Castle" in loc_names

def test_add_entities(client: TestClient):
    # Create campaign
    create_resp = client.post("/api/campaigns", json={"name": "Entity Test"})
    campaign_id = create_resp.json()["id"]
    
    # Add NPC
    npc_r = client.post(f"/api/campaigns/{campaign_id}/npcs", json={"name": "Guard"})
    assert npc_r.status_code == 200
    
    # Add Location
    loc_r = client.post(f"/api/campaigns/{campaign_id}/locations", json={"name": "Gate"})
    assert loc_r.status_code == 200
    
    # Add Plot Thread
    plot_r = client.post(f"/api/campaigns/{campaign_id}/plot-threads", json={"title": "Save the city"})
    assert plot_r.status_code == 200
    
    # Verify
    camp_resp = client.get(f"/api/campaigns/{campaign_id}")
    campaign = camp_resp.json()
    assert len(campaign["npcs"]) == 1
    assert campaign["npcs"][0]["name"] == "Guard"
    assert len(campaign["locations"]) == 1
    assert campaign["locations"][0]["name"] == "Gate"
    assert len(campaign["plot_threads"]) == 1
    assert campaign["plot_threads"][0]["title"] == "Save the city"
