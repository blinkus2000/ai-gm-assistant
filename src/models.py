"""
Pydantic data models for the AI GM Assistant.

Defines the domain objects: Campaign, Session, NPC, Location, Faction,
PlotThread, and supporting types. All models are system-agnostic — the
game_system field on Campaign drives how the generator interprets stats.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SessionStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    COMPLETED = "completed"


class PlotThreadStatus(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    DORMANT = "dormant"


class NPCRole(str, Enum):
    ALLY = "ally"
    VILLAIN = "villain"
    NEUTRAL = "neutral"
    PATRON = "patron"
    RIVAL = "rival"
    OTHER = "other"


class AdventureType(str, Enum):
    THWARTING = "thwarting"
    COLLECTING = "collecting"
    DELIVERING = "delivering"
    DISCOVERY = "discovery"


class AdversaryType(str, Enum):
    HEAVY_HITTER = "heavy_hitter"
    RACER = "racer"
    CHASER = "chaser"
    SHADOW = "shadow"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Sub-entities
# ---------------------------------------------------------------------------

class NPC(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    description: str = ""
    role: NPCRole = NPCRole.NEUTRAL
    stats: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""
    image_path: str | None = None
    created_at: str = Field(default_factory=_now)


class Location(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    description: str = ""
    points_of_interest: list[str] = Field(default_factory=list)
    hooks: list[str] = Field(default_factory=list)
    notes: str = ""
    image_path: str | None = None
    created_at: str = Field(default_factory=_now)


class Faction(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    description: str = ""
    goals: str = ""
    notable_members: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str = Field(default_factory=_now)


class PlotThread(BaseModel):
    id: str = Field(default_factory=_new_id)
    title: str
    description: str = ""
    status: PlotThreadStatus = PlotThreadStatus.ACTIVE
    related_npcs: list[str] = Field(default_factory=list)
    related_locations: list[str] = Field(default_factory=list)
    related_sessions: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str = Field(default_factory=_now)


class Session(BaseModel):
    id: str = Field(default_factory=_new_id)
    number: int = 0
    title: str = ""
    summary: str = ""
    plan: str = ""
    npcs_involved: list[str] = Field(default_factory=list)
    locations_visited: list[str] = Field(default_factory=list)
    plot_developments: list[str] = Field(default_factory=list)
    key_events: list[str] = Field(default_factory=list)
    status: SessionStatus = SessionStatus.DRAFT
    notes: str = ""
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class RulesetInfo(BaseModel):
    """Metadata about an uploaded ruleset PDF (stored locally, not the file content)."""
    file_name: str
    display_name: str
    gemini_file_name: str | None = None  # Gemini File Search store file ref
    uploaded_at: str = Field(default_factory=_now)


class Adversary(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    description: str = ""
    adventure_type: AdventureType = AdventureType.THWARTING
    adversary_type: AdversaryType = AdversaryType.HEAVY_HITTER
    steps: list[str] = Field(default_factory=list)
    notes: str = ""
    image_path: str | None = None
    created_at: str = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Campaign (top-level aggregate)
# ---------------------------------------------------------------------------

class Campaign(BaseModel):
    id: str = Field(default_factory=_new_id)
    schema_version: int = 1
    name: str
    game_system: str = ""          # e.g. "D&D 5e", "Pathfinder 2e"
    setting: str = ""              # Campaign world / setting description
    ruleset_store_name: str | None = None   # Gemini File Search Store ID
    rulesets: list[RulesetInfo] = Field(default_factory=list)
    sessions: list[Session] = Field(default_factory=list)
    npcs: list[NPC] = Field(default_factory=list)
    locations: list[Location] = Field(default_factory=list)
    factions: list[Faction] = Field(default_factory=list)
    plot_threads: list[PlotThread] = Field(default_factory=list)
    adversaries: list[Adversary] = Field(default_factory=list)
    notes: str = ""
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# API request / response helpers
# ---------------------------------------------------------------------------

class CampaignSummary(BaseModel):
    """Lightweight view returned when listing campaigns."""
    id: str
    name: str
    game_system: str
    setting: str
    session_count: int
    npc_count: int
    created_at: str
    updated_at: str


class CreateCampaignRequest(BaseModel):
    name: str
    game_system: str = ""
    setting: str = ""


class UpdateCampaignRequest(BaseModel):
    name: str | None = None
    game_system: str | None = None
    setting: str | None = None
    notes: str | None = None


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    plan: str | None = None
    npcs_involved: list[str] | None = None
    locations_visited: list[str] | None = None
    plot_developments: list[str] | None = None
    key_events: list[str] | None = None
    status: SessionStatus | None = None
    notes: str | None = None


class UpdateNPCRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    role: NPCRole | None = None
    stats: dict[str, Any] | None = None
    notes: str | None = None
    image_path: str | None = None


class UpdateLocationRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    points_of_interest: list[str] | None = None
    hooks: list[str] | None = None
    notes: str | None = None
    image_path: str | None = None


class UpdateFactionRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    goals: str | None = None
    notable_members: list[str] | None = None
    notes: str | None = None


class UpdatePlotThreadRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: PlotThreadStatus | None = None
    related_npcs: list[str] | None = None
    related_locations: list[str] | None = None
    related_sessions: list[str] | None = None
    notes: str | None = None


class UpdateAdversaryRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    adventure_type: AdventureType | None = None
    adversary_type: AdversaryType | None = None
    steps: list[str] | None = None
    notes: str | None = None
    image_path: str | None = None


class GenerateRequest(BaseModel):
    """Generic generation request body."""
    prompt: str
    context: str | None = None  # Additional context the GM wants to provide


class EnhanceRequest(BaseModel):
    """Request body for enhancing an existing entity."""
    prompt: str | None = None


class GenerateSessionRequest(BaseModel):
    prompt: str
    session_number: int | None = None
    context: str | None = None
    selected_npc_ids: list[str] = Field(default_factory=list)
    selected_location_ids: list[str] = Field(default_factory=list)
    selected_plot_thread_ids: list[str] = Field(default_factory=list)


class GenerateNPCRequest(BaseModel):
    prompt: str
    role: NPCRole | None = None
    context: str | None = None


class GenerateEncounterRequest(BaseModel):
    prompt: str
    party_level: int | None = None
    party_size: int | None = None
    difficulty: str | None = None
    context: str | None = None


class GenerateModuleRequest(BaseModel):
    prompt: str
    title: str | None = None
    include_illustrations: bool = True
    context: str | None = None


class GenerateAdversaryRequest(BaseModel):
    prompt: str
    adventure_type: AdventureType
    adversary_type: AdversaryType
    context: str | None = None
    selected_npc_ids: list[str] = Field(default_factory=list)
    selected_location_ids: list[str] = Field(default_factory=list)
    selected_plot_thread_ids: list[str] = Field(default_factory=list)
# ---------------------------------------------------------------------------
# App Settings
# ---------------------------------------------------------------------------

class AppSettings(BaseModel):
    """Global configuration for the GM Assistant."""
    reasoning_model: str = "gemini-3-flash-preview"
    image_model: str = "imagen-4.0-generate-001"
