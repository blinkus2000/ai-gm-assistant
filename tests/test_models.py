import pytest
from src.models import (
    Campaign, Session, NPC, Location, Faction, PlotThread,
    SessionStatus, NPCRole, PlotThreadStatus
)

def test_campaign_defaults():
    campaign = Campaign(name="Test Campaign")
    assert campaign.id is not None
    assert campaign.name == "Test Campaign"
    assert campaign.sessions == []
    assert campaign.npcs == []
    assert campaign.locations == []

def test_session_creation():
    session = Session(title="Session 1", summary="Start")
    assert session.status == SessionStatus.DRAFT
    assert session.number == 0

def test_npc_creation():
    npc = NPC(name="Bob")
    assert npc.role == NPCRole.NEUTRAL
    assert npc.id is not None

def test_campaign_add_entities():
    campaign = Campaign(name="Test")
    npc = NPC(name="Goblin King", role=NPCRole.VILLAIN)
    loc = Location(name="Goblin Cave")
    thread = PlotThread(title="Find the King", status=PlotThreadStatus.ACTIVE)
    session = Session(title="Cave dive", npcs_involved=[npc.name], locations_visited=[loc.name])
    
    campaign.npcs.append(npc)
    campaign.locations.append(loc)
    campaign.plot_threads.append(thread)
    campaign.sessions.append(session)
    
    assert len(campaign.npcs) == 1
    assert len(campaign.locations) == 1
    assert len(campaign.plot_threads) == 1
    assert len(campaign.sessions) == 1

def test_model_dumping():
    campaign = Campaign(name="Test System", game_system="D&D 5e")
    data = campaign.model_dump()
    assert data["name"] == "Test System"
    assert data["game_system"] == "D&D 5e"
    assert "id" in data
