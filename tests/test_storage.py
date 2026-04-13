import pytest
from src.models import Campaign, NPC
from src import storage

def test_save_and_load_campaign():
    campaign = Campaign(name="Storage Test", game_system="Pathfinder")
    npc = NPC(name="Test NPC")
    campaign.npcs.append(npc)
    
    # Save the campaign
    storage.save_campaign(campaign)
    
    # Load it back
    loaded = storage.load_campaign(campaign.id)
    assert loaded is not None
    assert loaded.id == campaign.id
    assert loaded.name == "Storage Test"
    assert len(loaded.npcs) == 1
    assert loaded.npcs[0].name == "Test NPC"

def test_load_nonexistent_campaign():
    assert storage.load_campaign("does_not_exist") is None

def test_list_campaigns():
    c1 = Campaign(name="Campaign 1")
    c2 = Campaign(name="Campaign 2")
    storage.save_campaign(c1)
    storage.save_campaign(c2)
    
    summaries = storage.list_campaigns()
    assert len(summaries) >= 2
    names = [s.name for s in summaries]
    assert "Campaign 1" in names
    assert "Campaign 2" in names

def test_delete_campaign():
    c = Campaign(name="Delete Me")
    storage.save_campaign(c)
    
    assert storage.load_campaign(c.id) is not None
    
    deleted = storage.delete_campaign(c.id)
    assert deleted is True
    assert storage.load_campaign(c.id) is None
    
    # Delete again should return False
    assert storage.delete_campaign(c.id) is False
