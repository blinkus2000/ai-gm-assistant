"""
FastAPI server — REST API for the AI GM Assistant.

Serves the static frontend and provides endpoints for campaign CRUD,
ruleset management, content generation, and PDF module export.
"""

from __future__ import annotations

import logging
import shutil
import time
from datetime import datetime, timezone

import google.genai.errors
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import generator, ruleset_manager, storage
from .models import (
    NPC,
    Adversary,
    AppSettings,
    Campaign,
    CampaignSummary,
    CreateCampaignRequest,
    EnhanceRequest,
    Faction,
    GenerateAdversaryRequest,
    GenerateEncounterRequest,
    GenerateModuleRequest,
    GenerateNPCRequest,
    GenerateRequest,
    GenerateSessionRequest,
    Location,
    NPCRole,
    PlotThread,
    Session,
    UpdateAdversaryRequest,
    UpdateCampaignRequest,
    UpdateLocationRequest,
    UpdateNPCRequest,
    UpdatePlotThreadRequest,
    UpdateSessionRequest,
)
from .paths import get_data_dir, get_static_dir
from .pdf_builder import build_module_pdf

logger = logging.getLogger(__name__)

app = FastAPI(title="AI GM Assistant", version="1.0.0")

@app.exception_handler(google.genai.errors.APIError)
async def genai_api_error_handler(request: Request, exc: google.genai.errors.APIError):
    logger.error("Gemini API Error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": f"AI Generation failed: {exc}"},
    )


# ---------------------------------------------------------------------------
# Serve the static frontend
# ---------------------------------------------------------------------------

STATIC_DIR = get_static_dir()


@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


# Mount static files AFTER the root route
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

IMAGES_DIR = get_data_dir() / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_campaign(campaign_id: str) -> Campaign:
    campaign = storage.load_campaign(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _update_campaign_entity(campaign_id: str, collection_name: str, entity_id: str, updates: BaseModel) -> dict:
    campaign = _get_campaign(campaign_id)
    collection = getattr(campaign, collection_name)
    for entity in collection:
        if entity.id == entity_id:
            for key, value in updates.model_dump(exclude_unset=True).items():
                if hasattr(entity, key):
                    setattr(entity, key, value)
            if hasattr(entity, "updated_at"):
                entity.updated_at = _now()
            campaign.updated_at = _now()
            storage.save_campaign(campaign)
            return {"status": "ok"}
    raise HTTPException(status_code=404, detail=f"Entity not found in {collection_name}")


# ---------------------------------------------------------------------------
# Campaign CRUD
# ---------------------------------------------------------------------------

@app.get("/api/campaigns", response_model=list[CampaignSummary])
async def list_campaigns():
    return storage.list_campaigns()


@app.post("/api/campaigns", response_model=dict)
async def create_campaign(req: CreateCampaignRequest):
    campaign = Campaign(name=req.name, game_system=req.game_system, setting=req.setting)
    storage.save_campaign(campaign)
    return {"id": campaign.id, "name": campaign.name}


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    campaign = _get_campaign(campaign_id)
    return campaign.model_dump()


@app.put("/api/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, req: UpdateCampaignRequest):
    campaign = _get_campaign(campaign_id)
    if req.name is not None:
        campaign.name = req.name
    if req.game_system is not None:
        campaign.game_system = req.game_system
    if req.setting is not None:
        campaign.setting = req.setting
    if req.notes is not None:
        campaign.notes = req.notes
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok"}


@app.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    campaign = storage.load_campaign(campaign_id)
    if campaign and campaign.ruleset_store_name:
        ruleset_manager.delete_ruleset_store(campaign.ruleset_store_name)
    if not storage.delete_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# App Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings", response_model=AppSettings)
async def get_settings():
    return storage.load_settings()


@app.put("/api/settings")
async def update_settings(settings: AppSettings):
    storage.save_settings(settings)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/sessions")
async def add_session(campaign_id: str, session: Session):
    campaign = _get_campaign(campaign_id)
    if session.number == 0:
        session.number = len(campaign.sessions) + 1

    # Auto-create newly referenced NPCs
    existing_npc_names = {n.name.lower() for n in campaign.npcs}
    for npc_name in session.npcs_involved:
        if npc_name and npc_name.lower() not in existing_npc_names:
            campaign.npcs.append(NPC(name=npc_name))
            existing_npc_names.add(npc_name.lower())

    # Auto-create newly referenced Locations
    existing_loc_names = {loc.name.lower() for loc in campaign.locations}
    for loc_name in session.locations_visited:
        if loc_name and loc_name.lower() not in existing_loc_names:
            campaign.locations.append(Location(name=loc_name))
            existing_loc_names.add(loc_name.lower())

    campaign.sessions.append(session)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "session_id": session.id}


@app.put("/api/campaigns/{campaign_id}/sessions/{session_id}")
async def update_session(campaign_id: str, session_id: str, updates: UpdateSessionRequest):
    return _update_campaign_entity(campaign_id, "sessions", session_id, updates)


@app.delete("/api/campaigns/{campaign_id}/sessions/{session_id}")
async def delete_session(campaign_id: str, session_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.sessions = [s for s in campaign.sessions if s.id != session_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# NPCs
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/npcs")
async def add_npc(campaign_id: str, npc: NPC):
    campaign = _get_campaign(campaign_id)
    campaign.npcs.append(npc)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "npc_id": npc.id}


@app.put("/api/campaigns/{campaign_id}/npcs/{npc_id}")
async def update_npc(campaign_id: str, npc_id: str, updates: UpdateNPCRequest):
    return _update_campaign_entity(campaign_id, "npcs", npc_id, updates)


@app.delete("/api/campaigns/{campaign_id}/npcs/{npc_id}")
async def delete_npc(campaign_id: str, npc_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.npcs = [n for n in campaign.npcs if n.id != npc_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/locations")
async def add_location(campaign_id: str, location: Location):
    campaign = _get_campaign(campaign_id)
    campaign.locations.append(location)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "location_id": location.id}


@app.put("/api/campaigns/{campaign_id}/locations/{location_id}")
async def update_location(campaign_id: str, location_id: str, updates: UpdateLocationRequest):
    return _update_campaign_entity(campaign_id, "locations", location_id, updates)


@app.delete("/api/campaigns/{campaign_id}/locations/{location_id}")
async def delete_location(campaign_id: str, location_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.locations = [loc for loc in campaign.locations if loc.id != location_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Factions
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/factions")
async def add_faction(campaign_id: str, faction: Faction):
    campaign = _get_campaign(campaign_id)
    campaign.factions.append(faction)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "faction_id": faction.id}


@app.delete("/api/campaigns/{campaign_id}/factions/{faction_id}")
async def delete_faction(campaign_id: str, faction_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.factions = [f for f in campaign.factions if f.id != faction_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Plot Threads
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/plot-threads")
async def add_plot_thread(campaign_id: str, thread: PlotThread):
    campaign = _get_campaign(campaign_id)
    campaign.plot_threads.append(thread)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "thread_id": thread.id}


@app.put("/api/campaigns/{campaign_id}/plot-threads/{thread_id}")
async def update_plot_thread(campaign_id: str, thread_id: str, updates: UpdatePlotThreadRequest):
    return _update_campaign_entity(campaign_id, "plot_threads", thread_id, updates)


@app.delete("/api/campaigns/{campaign_id}/plot-threads/{thread_id}")
async def delete_plot_thread(campaign_id: str, thread_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.plot_threads = [p for p in campaign.plot_threads if p.id != thread_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Adversaries
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/adversaries")
async def add_adversary(campaign_id: str, adversary: Adversary):
    campaign = _get_campaign(campaign_id)
    campaign.adversaries.append(adversary)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "ok", "adversary_id": adversary.id}


@app.put("/api/campaigns/{campaign_id}/adversaries/{adversary_id}")
async def update_adversary(campaign_id: str, adversary_id: str, updates: UpdateAdversaryRequest):
    return _update_campaign_entity(campaign_id, "adversaries", adversary_id, updates)


@app.delete("/api/campaigns/{campaign_id}/adversaries/{adversary_id}")
async def delete_adversary(campaign_id: str, adversary_id: str):
    campaign = _get_campaign(campaign_id)
    campaign.adversaries = [a for a in campaign.adversaries if a.id != adversary_id]
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Ruleset management
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/rulesets")
async def upload_ruleset(
    campaign_id: str,
    file: UploadFile = File(...),
    display_name: str = Form(""),
):
    """Upload a PDF ruleset and index it in the campaign's File Search Store."""
    campaign = _get_campaign(campaign_id)

    # Create store if this is the first ruleset
    if not campaign.ruleset_store_name:
        campaign.ruleset_store_name = ruleset_manager.create_ruleset_store(campaign.name)

    # Save PDF locally
    filename = file.filename or "ruleset.pdf"
    rulesets_dir = storage.get_campaign_rulesets_dir(campaign_id)
    pdf_path = rulesets_dir / filename
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Upload to Gemini File Search Store
    name = display_name or filename.replace(".pdf", "")
    info = ruleset_manager.upload_ruleset_pdf(
        store_name=campaign.ruleset_store_name,
        pdf_path=pdf_path,
        display_name=name,
    )

    campaign.rulesets.append(info)
    campaign.updated_at = _now()
    storage.save_campaign(campaign)

    return {"status": "ok", "ruleset": info.model_dump()}


@app.get("/api/campaigns/{campaign_id}/rulesets")
async def list_rulesets(campaign_id: str):
    campaign = _get_campaign(campaign_id)
    return [r.model_dump() for r in campaign.rulesets]


# ---------------------------------------------------------------------------
# Content generation
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/generate/session")
async def gen_session(campaign_id: str, req: GenerateSessionRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.generate_session(
        campaign, req.prompt, req.session_number, req.context or ""
    )
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/generate/npc")
async def gen_npc(campaign_id: str, req: GenerateNPCRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.generate_npc(
        campaign, req.prompt, req.role, req.context or ""
    )
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/generate/encounter")
async def gen_encounter(campaign_id: str, req: GenerateEncounterRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.generate_encounter(
        campaign, req.prompt, req.party_level, req.party_size, req.difficulty, req.context or ""
    )
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/generate/location")
async def gen_location(campaign_id: str, req: GenerateRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.generate_location(campaign, req.prompt, req.context or "")
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/generate/ask-rules")
async def gen_ask_rules(campaign_id: str, req: GenerateRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.ask_rules(campaign, req.prompt)
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/generate/adversary")
async def gen_adversary(campaign_id: str, req: GenerateAdversaryRequest):
    campaign = _get_campaign(campaign_id)
    result = generator.generate_adversary(
        campaign, req.prompt, req.adventure_type, req.adversary_type,
        req.context or "", req.selected_npc_ids, req.selected_location_ids, req.selected_plot_thread_ids
    )
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/npcs/{npc_id}/enhance")
async def api_enhance_npc(campaign_id: str, npc_id: str, req: EnhanceRequest):
    campaign = _get_campaign(campaign_id)
    npc = next((n for n in campaign.npcs if n.id == npc_id), None)
    if not npc:
        raise HTTPException(status_code=404, detail="NPC not found")
    result = generator.enhance_npc(campaign, npc.model_dump_json(), guidance_prompt=req.prompt)
    try:
        npc.role = NPCRole(result.role)
    except (ValueError, KeyError):
        pass
    npc.description = result.description
    if result.stats:
        npc.stats = result.stats
    if result.notes:
        npc.notes = result.notes
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/locations/{location_id}/enhance")
async def api_enhance_location(campaign_id: str, location_id: str, req: EnhanceRequest):
    campaign = _get_campaign(campaign_id)
    loc = next((loc for loc in campaign.locations if loc.id == location_id), None)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    result = generator.enhance_location(campaign, loc.model_dump_json(), guidance_prompt=req.prompt)
    loc.description = result.description
    if result.points_of_interest:
        loc.points_of_interest = result.points_of_interest
    if result.hooks:
        loc.hooks = result.hooks
    if result.notes:
        loc.notes = result.notes
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/plot-threads/{thread_id}/enhance")
async def api_enhance_plot_thread(campaign_id: str, thread_id: str, req: EnhanceRequest):
    campaign = _get_campaign(campaign_id)
    plot = next((p for p in campaign.plot_threads if p.id == thread_id), None)
    if not plot:
        raise HTTPException(status_code=404, detail="Plot Thread not found")
    result = generator.enhance_plot_thread(campaign, plot.model_dump_json(), guidance_prompt=req.prompt)
    plot.description = result.description
    if result.notes:
        plot.notes = result.notes
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/sessions/{session_id}/enhance")
async def api_enhance_session(campaign_id: str, session_id: str, req: EnhanceRequest):
    campaign = _get_campaign(campaign_id)
    session = next((s for s in campaign.sessions if s.id == session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = generator.enhance_session(campaign, session.model_dump_json(), guidance_prompt=req.prompt)

    session.title = result.title
    session.summary = result.summary
    session.plan = result.plan
    if result.npcs_involved:
        session.npcs_involved = list(set(session.npcs_involved + result.npcs_involved))
    if result.locations_visited:
        session.locations_visited = list(set(session.locations_visited + result.locations_visited))
    if result.key_events:
        session.key_events = list(set(session.key_events + result.key_events))

    session.updated_at = _now()
    campaign.updated_at = _now()
    storage.save_campaign(campaign)
    return result.model_dump()


@app.post("/api/campaigns/{campaign_id}/npcs/{npc_id}/generate-image")
async def api_generate_npc_image(campaign_id: str, npc_id: str):
    campaign = _get_campaign(campaign_id)
    npc = next((n for n in campaign.npcs if n.id == npc_id), None)
    if not npc:
        raise HTTPException(status_code=404, detail="NPC not found")

    # 1. Art Director stage
    logger.info("NPC Art Director starting for: %s", npc.name)
    art_prompt = generator.generate_art_prompt(campaign, f"Name: {npc.name}\nRole: {npc.role}\nDescription: {npc.description}")

    # 2. Generation stage
    logger.info("Generating illustration for NPC %s with Art Director prompt: %s", npc.name, art_prompt)
    image_bytes = generator.generate_illustration(art_prompt, style="")
    if not image_bytes:
        raise HTTPException(status_code=500, detail="Image generation failed")

    # 3. Cleanup old image if it exists
    if npc.image_path:
        storage.delete_image(npc.image_path)

    # 4. Save with unique filename to avoid caching
    images_dir = storage.get_images_dir(campaign_id)
    filename = f"npc_{npc.id}_{hex(int(time.time()))[2:]}.png"
    filepath = images_dir / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # 5. Update NPC
    npc.image_path = f"/images/{campaign_id}/{filename}"
    campaign.updated_at = _now()
    storage.save_campaign(campaign)

    return {"status": "ok", "image_path": npc.image_path}


@app.post("/api/campaigns/{campaign_id}/locations/{location_id}/generate-image")
async def api_generate_location_image(campaign_id: str, location_id: str):
    campaign = _get_campaign(campaign_id)
    loc = next((loc for loc in campaign.locations if loc.id == location_id), None)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    # 1. Art Director stage
    logger.info("Location Art Director starting for: %s", loc.name)
    art_prompt = generator.generate_art_prompt(campaign, f"Name: {loc.name}\nDescription: {loc.description}")

    # 2. Generation stage
    logger.info("Generating illustration for Location %s with Art Director prompt: %s", loc.name, art_prompt)
    image_bytes = generator.generate_illustration(art_prompt, style="")
    if not image_bytes:
        raise HTTPException(status_code=500, detail="Image generation failed")

    # 3. Cleanup old image
    if loc.image_path:
        storage.delete_image(loc.image_path)

    # 4. Save unique
    images_dir = storage.get_images_dir(campaign_id)
    filename = f"loc_{loc.id}_{hex(int(time.time()))[2:]}.png"
    filepath = images_dir / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # 5. Update Location
    loc.image_path = f"/images/{campaign_id}/{filename}"
    storage.save_campaign(campaign)

    return {"status": "ok", "image_path": loc.image_path}


@app.post("/api/campaigns/{campaign_id}/adversaries/{adversary_id}/generate-image")
async def api_generate_adversary_image(campaign_id: str, adversary_id: str):
    campaign = _get_campaign(campaign_id)
    adv = next((a for a in campaign.adversaries if a.id == adversary_id), None)
    if not adv:
        raise HTTPException(status_code=404, detail="Adversary not found")

    # 1. Art Director stage
    logger.info("Adversary Art Director starting for: %s", adv.name)
    art_prompt = generator.generate_art_prompt(campaign, f"Name: {adv.name}\nType: {adv.adversary_type}\nDescription: {adv.description}")

    # 2. Generation stage
    logger.info("Generating illustration for Adversary %s with Art Director prompt: %s", adv.name, art_prompt)
    image_bytes = generator.generate_illustration(art_prompt, style="")
    if not image_bytes:
        raise HTTPException(status_code=500, detail="Image generation failed")

    # 3. Cleanup old image
    if adv.image_path:
        storage.delete_image(adv.image_path)

    # 4. Save unique
    images_dir = storage.get_images_dir(campaign_id)
    filename = f"adv_{adv.id}_{hex(int(time.time()))[2:]}.png"
    filepath = images_dir / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # 5. Update Adversary
    adv.image_path = f"/images/{campaign_id}/{filename}"
    campaign.updated_at = _now()
    storage.save_campaign(campaign)

    return {"status": "ok", "image_path": adv.image_path}


# ---------------------------------------------------------------------------
# Module generation + download
# ---------------------------------------------------------------------------

@app.post("/api/campaigns/{campaign_id}/modules/generate")
async def gen_module(campaign_id: str, req: GenerateModuleRequest):
    campaign = _get_campaign(campaign_id)

    # Generate module content
    module = generator.generate_module(
        campaign, req.prompt, req.title, req.context or ""
    )

    # Build PDF
    pdf_path = build_module_pdf(
        module=module,
        campaign_name=campaign.name,
        game_system=campaign.game_system,
        include_illustrations=req.include_illustrations,
    )

    return {
        "status": "ok",
        "module": module.model_dump(),
        "pdf_filename": pdf_path.name,
    }


@app.get("/api/modules/{filename}/download")
async def download_module(filename: str):
    pdf_path = get_data_dir() / "modules" / filename
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Module PDF not found")
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=filename,
    )


@app.get("/api/modules")
async def list_modules():
    modules_dir = get_data_dir() / "modules"
    modules_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(modules_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [{"filename": f.name, "size": f.stat().st_size} for f in files]
