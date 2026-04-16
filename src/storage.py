"""
JSON-file-based persistence layer for campaigns.

Each campaign is stored as a single JSON file in data/campaigns/{id}.json.
This keeps things simple, portable, and human-readable.
"""

from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path

from .models import AppSettings, Campaign, CampaignSummary
from .paths import get_data_dir

logger = logging.getLogger(__name__)

# Resolved at import time; works in both dev and frozen modes
DATA_DIR = get_data_dir() / "campaigns"
SETTINGS_PATH = get_data_dir() / "settings.json"


def _ensure_dirs() -> None:
    """Create the data directory structure if it doesn't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _campaign_path(campaign_id: str) -> Path:
    return DATA_DIR / f"{campaign_id}.json"


def save_campaign(campaign: Campaign) -> None:
    """Persist a campaign to disk."""
    _ensure_dirs()
    path = _campaign_path(campaign.id)
    path.write_text(campaign.model_dump_json(indent=2), encoding="utf-8")


def load_campaign(campaign_id: str) -> Campaign | None:
    """Load a campaign from disk, or return None if not found."""
    path = _campaign_path(campaign_id)
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return Campaign.model_validate(data)


def list_campaigns() -> list[CampaignSummary]:
    """Return lightweight summaries of all campaigns."""
    _ensure_dirs()
    summaries: list[CampaignSummary] = []
    for file in sorted(DATA_DIR.glob("*.json")):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            summaries.append(
                CampaignSummary(
                    id=data["id"],
                    name=data["name"],
                    game_system=data.get("game_system", ""),
                    setting=data.get("setting", ""),
                    session_count=len(data.get("sessions", [])),
                    npc_count=len(data.get("npcs", [])),
                    created_at=data.get("created_at", ""),
                    updated_at=data.get("updated_at", ""),
                )
            )
        except (json.JSONDecodeError, KeyError):
            continue  # Skip corrupted files
    return summaries


def delete_campaign(campaign_id: str) -> bool:
    """Delete a campaign file and its assets. Return True if it existed."""
    path = _campaign_path(campaign_id)
    if path.exists():
        path.unlink()

        # Cleanup associated assets
        images_dir = get_data_dir() / "images" / campaign_id
        if images_dir.exists():
            shutil.rmtree(images_dir, ignore_errors=True)

        rulesets_dir = get_data_dir() / "rulesets" / campaign_id
        if rulesets_dir.exists():
            shutil.rmtree(rulesets_dir, ignore_errors=True)

        return True
    return False


def get_campaign_rulesets_dir(campaign_id: str) -> Path:
    """Return the directory where uploaded ruleset PDFs are stored for a campaign."""
    d = get_data_dir() / "rulesets" / campaign_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_images_dir(campaign_id: str) -> Path:
    """Return the directory where AI-generated images are stored for a campaign."""
    d = get_data_dir() / "images" / campaign_id
    d.mkdir(parents=True, exist_ok=True)
    return d

def load_settings() -> AppSettings:
    """Load global app settings, or return defaults if not found."""
    if not SETTINGS_PATH.exists():
        return AppSettings()
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return AppSettings.model_validate(data)
    except Exception:
        return AppSettings()


def save_settings(settings: AppSettings) -> None:
    """Persist app settings to disk."""
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(settings.model_dump_json(indent=2), encoding="utf-8")


def delete_image(image_path: str) -> None:
    """Safely delete an image file from the data/images directory."""
    if not image_path:
        return

    # image_path is like "/images/<campaign_id>/<filename>.png"
    # We need to translate this to a local path
    parts = image_path.split("/")
    if len(parts) < 4 or parts[1] != "images":
        return

    campaign_id = parts[2]
    filename = parts[3]

    local_path = get_data_dir() / "images" / campaign_id / filename

    if local_path.exists() and local_path.is_file():
        try:
            local_path.unlink()
            logger.info("Deleted old image: %s", local_path)
        except Exception as e:
            logger.error("Failed to delete image %s: %s", local_path, e)
