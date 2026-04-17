"""
SQLite-based persistence layer for campaigns.

Provides full Campaign object graph serialization matching the old JSON schema.
"""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
from pathlib import Path

from .models import AppSettings, Campaign, CampaignSummary
from .paths import get_data_dir

logger = logging.getLogger(__name__)

# Resolved at import time
DATA_DIR = get_data_dir()
DB_PATH = DATA_DIR / "app.db"
SETTINGS_PATH = DATA_DIR / "settings.json"


def _ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        # Usually handled by migration, but just in case
        pass


def get_conn() -> sqlite3.Connection:
    _ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _loads(val):
    if not val: return []
    try:
        return json.loads(val)
    except:
        return []


def _loads_dict(val):
    if not val: return {}
    try:
        return json.loads(val)
    except:
        return {}


def save_campaign(campaign: Campaign) -> None:
    """Persist a fully structured campaign back to DB."""
    conn = get_conn()
    cur = conn.cursor()
    c = campaign

    try:
        # Campaign
        cur.execute("""
            INSERT OR REPLACE INTO campaigns 
            (id, schema_version, name, game_system, setting, ruleset_store_name, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (c.id, c.schema_version, c.name, c.game_system, c.setting, c.ruleset_store_name, c.notes, c.created_at, c.updated_at))

        # Rulesets
        cur.execute("DELETE FROM rulesets WHERE campaign_id = ?", (c.id,))
        for r in c.rulesets:
            cur.execute("""INSERT INTO rulesets (file_name, campaign_id, display_name, gemini_file_name, uploaded_at) VALUES (?, ?, ?, ?, ?)""",
                        (r.file_name, c.id, r.display_name, r.gemini_file_name, r.uploaded_at))

        # Sessions
        cur.execute("DELETE FROM sessions WHERE campaign_id = ?", (c.id,))
        for s in c.sessions:
            cur.execute("""INSERT INTO sessions 
                (id, campaign_id, number, title, summary, plan, npcs_involved, locations_visited, plot_developments, key_events, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (s.id, c.id, s.number, s.title, s.summary, s.plan, json.dumps(s.npcs_involved), json.dumps(s.locations_visited), json.dumps(s.plot_developments), json.dumps(s.key_events), s.status.value, s.notes, s.created_at, s.updated_at))

        # NPCs
        cur.execute("DELETE FROM npcs WHERE campaign_id = ?", (c.id,))
        for n in c.npcs:
            cur.execute("""INSERT INTO npcs 
                (id, campaign_id, name, description, role, stats, notes, image_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (n.id, c.id, n.name, n.description, n.role.value, json.dumps(n.stats), n.notes, n.image_path, n.created_at))

        # Locations
        cur.execute("DELETE FROM locations WHERE campaign_id = ?", (c.id,))
        for l in c.locations:
            cur.execute("""INSERT INTO locations 
                (id, campaign_id, name, description, points_of_interest, hooks, notes, image_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (l.id, c.id, l.name, l.description, json.dumps(l.points_of_interest), json.dumps(l.hooks), l.notes, l.image_path, l.created_at))

        # Plot Threads
        cur.execute("DELETE FROM plot_threads WHERE campaign_id = ?", (c.id,))
        for pt in c.plot_threads:
            cur.execute("""INSERT INTO plot_threads 
                (id, campaign_id, title, description, status, related_npcs, related_locations, related_sessions, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (pt.id, c.id, pt.title, pt.description, pt.status.value, json.dumps(pt.related_npcs), json.dumps(pt.related_locations), json.dumps(pt.related_sessions), pt.notes, pt.created_at))

        # Adversaries
        cur.execute("DELETE FROM adversaries WHERE campaign_id = ?", (c.id,))
        for a in c.adversaries:
            cur.execute("""INSERT INTO adversaries 
                (id, campaign_id, name, description, adventure_type, adversary_type, steps, notes, image_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (a.id, c.id, a.name, a.description, a.adventure_type.value, a.adversary_type.value, json.dumps(a.steps), a.notes, a.image_path, a.created_at))
                
        # Factions
        cur.execute("DELETE FROM factions WHERE campaign_id = ?", (c.id,))
        for f in c.factions:
            cur.execute("""INSERT INTO factions 
                (id, campaign_id, name, description, goals, notable_members, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (f.id, c.id, f.name, f.description, f.goals, json.dumps(f.notable_members), f.notes, f.created_at))

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Failed to save campaign: %s", e)
        raise
    finally:
        conn.close()


def load_campaign(campaign_id: str) -> Campaign | None:
    """Load an entire campaign from disk by gathering it from SQLite."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        c_row = cur.fetchone()
        if not c_row:
            return None
        
        c_dict = dict(c_row)
        
        # Hydrate Rulesets
        cur.execute("SELECT * FROM rulesets WHERE campaign_id = ?", (campaign_id,))
        c_dict["rulesets"] = [dict(r) for r in cur.fetchall()]
        
        # Hydrate Sessions
        cur.execute("SELECT * FROM sessions WHERE campaign_id = ? ORDER BY number ASC", (campaign_id,))
        sessions = []
        for s in cur.fetchall():
            d = dict(s)
            d["npcs_involved"] = _loads(d["npcs_involved"])
            d["locations_visited"] = _loads(d["locations_visited"])
            d["plot_developments"] = _loads(d["plot_developments"])
            d["key_events"] = _loads(d["key_events"])
            sessions.append(d)
        c_dict["sessions"] = sessions
        
        # Hydrate NPCs
        cur.execute("SELECT * FROM npcs WHERE campaign_id = ?", (campaign_id,))
        npcs = []
        for n in cur.fetchall():
            d = dict(n)
            d["stats"] = _loads_dict(d["stats"])
            npcs.append(d)
        c_dict["npcs"] = npcs
        
        # Hydrate Locations
        cur.execute("SELECT * FROM locations WHERE campaign_id = ?", (campaign_id,))
        locs = []
        for l in cur.fetchall():
            d = dict(l)
            d["points_of_interest"] = _loads(d["points_of_interest"])
            d["hooks"] = _loads(d["hooks"])
            locs.append(d)
        c_dict["locations"] = locs
        
        # Hydrate Plot Threads
        cur.execute("SELECT * FROM plot_threads WHERE campaign_id = ?", (campaign_id,))
        plots = []
        for p in cur.fetchall():
            d = dict(p)
            d["related_npcs"] = _loads(d["related_npcs"])
            d["related_locations"] = _loads(d["related_locations"])
            d["related_sessions"] = _loads(d["related_sessions"])
            plots.append(d)
        c_dict["plot_threads"] = plots
        
        # Hydrate Adversaries
        cur.execute("SELECT * FROM adversaries WHERE campaign_id = ?", (campaign_id,))
        advs = []
        for a in cur.fetchall():
            d = dict(a)
            d["steps"] = _loads(d["steps"])
            advs.append(d)
        c_dict["adversaries"] = advs
        
        # Hydrate Factions
        cur.execute("SELECT * FROM factions WHERE campaign_id = ?", (campaign_id,))
        factions = []
        for f in cur.fetchall():
            d = dict(f)
            d["notable_members"] = _loads(d["notable_members"])
            factions.append(d)
        c_dict["factions"] = factions
        
        return Campaign.model_validate(c_dict)
    finally:
        conn.close()


def list_campaigns() -> list[CampaignSummary]:
    """Return lightweight summaries of all campaigns."""
    conn = get_conn()
    cur = conn.cursor()
    summaries: list[CampaignSummary] = []
    
    try:
        # Check if table exists (for first run cases)
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'")
        if not cur.fetchone():
            return []
            
        cur.execute("SELECT id, name, game_system, setting, created_at, updated_at FROM campaigns")
        for row in cur.fetchall():
            # fetch counts
            cur.execute("SELECT count(*) FROM sessions WHERE campaign_id = ?", (row["id"],))
            scount = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM npcs WHERE campaign_id = ?", (row["id"],))
            ncount = cur.fetchone()[0]
            
            summaries.append(
                CampaignSummary(
                    id=row["id"],
                    name=row["name"],
                    game_system=row["game_system"] or "",
                    setting=row["setting"] or "",
                    session_count=scount,
                    npc_count=ncount,
                    created_at=row["created_at"] or "",
                    updated_at=row["updated_at"] or "",
                )
            )
        return summaries
    except Exception as e:
        logger.error("Failed to list campaigns: %s", e)
        return []
    finally:
        conn.close()


def delete_campaign(campaign_id: str) -> bool:
    """Delete a campaign entirely."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM campaigns WHERE id = ?", (campaign_id,))
        if not cur.fetchone():
            return False
            
        cur.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        conn.commit()

        # Cleanup associated assets
        images_dir = get_data_dir() / "images" / campaign_id
        if images_dir.exists():
            shutil.rmtree(images_dir, ignore_errors=True)

        rulesets_dir = get_data_dir() / "rulesets" / campaign_id
        if rulesets_dir.exists():
            shutil.rmtree(rulesets_dir, ignore_errors=True)

        return True
    finally:
        conn.close()


def get_campaign_rulesets_dir(campaign_id: str) -> Path:
    d = get_data_dir() / "rulesets" / campaign_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_images_dir(campaign_id: str) -> Path:
    d = get_data_dir() / "images" / campaign_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_settings() -> AppSettings:
    if not SETTINGS_PATH.exists():
        return AppSettings()
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return AppSettings.model_validate(data)
    except Exception:
        return AppSettings()


def save_settings(settings: AppSettings) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(settings.model_dump_json(indent=2), encoding="utf-8")


def delete_image(image_path: str) -> None:
    if not image_path:
        return
    parts = image_path.split("/")
    if len(parts) < 4 or parts[1] != "images":
        return
    campaign_id = parts[2]
    filename = parts[3]
    local_path = get_data_dir() / "images" / campaign_id / filename

    if local_path.exists() and local_path.is_file():
        try:
            local_path.unlink()
        except Exception as e:
            logger.error("Failed to delete image %s: %s", local_path, e)

def list_campaign_npcs(campaign_id: str, limit: int = 50, offset: int = 0) -> list[NPC]:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM npcs WHERE campaign_id = ? ORDER BY created_at LIMIT ? OFFSET ?", (campaign_id, limit, offset))
        result = []
        for n in cur.fetchall():
            d = dict(n)
            d["stats"] = _loads_dict(d["stats"])
            result.append(NPC.model_validate(d))
        return result
    finally:
        conn.close()

def list_campaign_locations(campaign_id: str, limit: int = 50, offset: int = 0) -> list[Location]:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM locations WHERE campaign_id = ? ORDER BY created_at LIMIT ? OFFSET ?", (campaign_id, limit, offset))
        result = []
        for l in cur.fetchall():
            d = dict(l)
            d["points_of_interest"] = _loads(d["points_of_interest"])
            d["hooks"] = _loads(d["hooks"])
            result.append(Location.model_validate(d))
        return result
    finally:
        conn.close()

def list_campaign_sessions(campaign_id: str, limit: int = 50, offset: int = 0) -> list[Session]:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM sessions WHERE campaign_id = ? ORDER BY number ASC LIMIT ? OFFSET ?", (campaign_id, limit, offset))
        result = []
        for s in cur.fetchall():
            d = dict(s)
            d["npcs_involved"] = _loads(d["npcs_involved"])
            d["locations_visited"] = _loads(d["locations_visited"])
            d["plot_developments"] = _loads(d["plot_developments"])
            d["key_events"] = _loads(d["key_events"])
            result.append(Session.model_validate(d))
        return result
    finally:
        conn.close()
