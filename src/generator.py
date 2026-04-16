"""
Content Generation Engine — the AI core of the GM Assistant.

All generation goes through Gemini with the campaign's File Search Store
attached as a tool, ensuring every rule reference is grounded in the
actual uploaded PDFs. Hallucinating rules is structurally prevented.
"""

from __future__ import annotations

import logging
from typing import Any, TypeVar

from google.genai import types
from pydantic import BaseModel, Field

from . import storage
from .gemini_client import get_client
from .models import (
    AdventureType,
    AdversaryType,
    Campaign,
    NPCRole,
)
from .ruleset_manager import get_file_search_tool

logger = logging.getLogger(__name__)


# Model selection helpers
def _get_reasoning_model() -> str:
    return storage.load_settings().reasoning_model

def _get_image_model() -> str:
    return storage.load_settings().image_model


# ---------------------------------------------------------------------------
# System instructions
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """You are an expert TTRPG Game Master assistant. Your role is to help
GMs plan sessions, create NPCs, design encounters, build locations, and develop plot threads.

CRITICAL RULES — FOLLOW WITHOUT EXCEPTION:
1. You MUST use the file_search tool to look up game rules before referencing
   ANY mechanic, stat block, ability, spell, class feature, monster stat, or rule.
2. NEVER invent or hallucinate game rules, stats, or mechanics. If the rule
   cannot be found in the provided rulesets, explicitly say:
   "⚠️ Rule not found in provided materials — please verify manually."
3. When referencing a rule, ALWAYS cite the source (book name, section, or page)
   so the GM can verify.
4. Maintain strict continuity with the campaign context provided. Reference
   existing NPCs, locations, plot threads, and prior sessions where relevant.
5. Generated content should be vivid, engaging, and immediately usable at the table.
6. Stat blocks must use the exact format and values from the ruleset — do not
   approximate or improvise stats.
"""

SYSTEM_INSTRUCTION_NO_RULES = """You are an expert TTRPG Game Master assistant. Your role is to help
GMs plan sessions, create NPCs, design encounters, build locations, and develop plot threads.

IMPORTANT: No ruleset PDFs have been uploaded for this campaign yet. You may generate
creative narrative content, but you CANNOT provide verified game mechanics, stat blocks,
or rule references. If the user asks about specific mechanics, remind them to upload
their ruleset PDFs first.

Generate vivid, engaging, and immediately usable narrative content. Maintain
continuity with the campaign context provided.
"""


# ---------------------------------------------------------------------------
# Structured output schemas for generation
# ---------------------------------------------------------------------------

class GeneratedSession(BaseModel):
    title: str = Field(description="A compelling title for the session")
    summary: str = Field(description="A brief 2-3 sentence overview of the session")
    plan: str = Field(description="Detailed session plan in markdown format, including scenes, encounters, read-aloud text, and NPC interactions")
    npcs_involved: list[str] = Field(description="Names of NPCs featured in this session")
    locations_visited: list[str] = Field(description="Names of locations featured in this session")
    plot_developments: list[str] = Field(description="Plot threads that advance in this session")
    key_events: list[str] = Field(description="Key events or turning points in the session")


class GeneratedNPC(BaseModel):
    name: str = Field(description="The NPC's full name")
    description: str = Field(description="Physical appearance, personality, mannerisms, and background")
    role: str = Field(description="One of: ally, villain, neutral, patron, rival, other")
    stats: dict[str, Any] = Field(description="Game-system stat block as key-value pairs. Only include if rules are available.")
    notes: str = Field(description="GM-facing notes: motivations, secrets, hooks")


class GeneratedEncounter(BaseModel):
    title: str = Field(description="Encounter title")
    description: str = Field(description="Scene setting and circumstances")
    enemies: list[dict[str, Any]] = Field(description="List of enemies with name, count, and stats from the ruleset")
    difficulty: str = Field(description="Estimated difficulty based on ruleset calculations")
    tactics: str = Field(description="How enemies behave tactically")
    treasure: str = Field(description="Rewards and loot")
    notes: str = Field(description="Additional GM notes")


class GeneratedLocation(BaseModel):
    name: str = Field(description="Location name")
    description: str = Field(description="Vivid description of the location")
    points_of_interest: list[str] = Field(description="Notable features or areas within the location")
    hooks: list[str] = Field(description="Adventure hooks connected to this location")
    notes: str = Field(description="GM-facing notes")


class GeneratedPlotThread(BaseModel):
    title: str = Field(description="Plot thread title")
    description: str = Field(description="Detailed description of the plot thread and what is currently happening")
    notes: str = Field(description="GM-facing notes on how to advance this plot, secrets, or future events")


class RuleAnswer(BaseModel):
    answer: str = Field(description="The answer to the rules question, citing sources")
    sources: list[str] = Field(description="List of source citations (book, page, section)")
    confidence: str = Field(description="'verified' if found in rulesets, 'unverified' if not found")


class GeneratedModuleSection(BaseModel):
    heading: str = Field(description="Section heading")
    content: str = Field(description="Section content in markdown")
    illustration_prompt: str = Field(description="A detailed prompt to generate an illustration for this section, or empty string if none needed")


class GeneratedModule(BaseModel):
    title: str = Field(description="Module title")
    introduction: str = Field(description="Module introduction/overview")
    sections: list[GeneratedModuleSection] = Field(description="Ordered list of module sections")
    appendix: str = Field(description="Stat blocks, treasure tables, or other reference material")


class ArtDirectorPrompt(BaseModel):
    prompt: str = Field(description="A highly detailed, style-coordinated illustration prompt for an image generator (like Imagen 3). Include lighting, composition, and specific visual details.")


class GeneratedAdversary(BaseModel):
    name: str = Field(description="The adversary's name")
    description: str = Field(description="Vivid description of the adversary, physical appearance and personality")
    steps: list[str] = Field(description="Exactly 5 story beats/steps for this adversary, fleshing out the template provided")
    notes: str = Field(description="GM-facing notes: motivations, secrets, hooks")


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def build_campaign_context(campaign: Campaign) -> str:
    """Build a text summary of the campaign state for the model."""
    parts = [
        f"# Campaign: {campaign.name}",
        f"**Game System:** {campaign.game_system or 'Not specified'}",
        f"**Setting:** {campaign.setting or 'Not specified'}",
    ]

    if campaign.notes:
        parts.append(f"\n**Campaign Notes:** {campaign.notes}")

    # Recent sessions (last 5 for context window management)
    if campaign.sessions:
        parts.append("\n## Recent Sessions")
        for s in campaign.sessions[-5:]:
            status_tag = f"[{s.status.value}]"
            parts.append(f"\n### Session {s.number}: {s.title} {status_tag}")
            if s.summary:
                parts.append(s.summary)
            if s.key_events:
                parts.append("**Key events:** " + "; ".join(s.key_events))

    # Active plot threads
    active_plots = [p for p in campaign.plot_threads if p.status == "active"]
    if active_plots:
        parts.append("\n## Active Plot Threads")
        for p in active_plots:
            parts.append(f"- **{p.title}:** {p.description}")

    # NPCs
    if campaign.npcs:
        parts.append("\n## Known NPCs")
        for npc in campaign.npcs:
            parts.append(f"- **{npc.name}** ({npc.role.value}): {npc.description[:200]}")

    # Locations
    if campaign.locations:
        parts.append("\n## Known Locations")
        for loc in campaign.locations:
            parts.append(f"- **{loc.name}:** {loc.description[:200]}")

    # Factions
    if campaign.factions:
        parts.append("\n## Factions")
        for f in campaign.factions:
            parts.append(f"- **{f.name}:** {f.description[:200]}")

    # Adversaries
    if campaign.adversaries:
        parts.append("\n## Primary Adversaries")
        for adv in campaign.adversaries:
            parts.append(f"- **{adv.name}** ({adv.adversary_type.value}): {adv.description[:200]}")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Generation functions
# ---------------------------------------------------------------------------


def _clean_json(text: str | None) -> str:
    text = (text or "{}").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def _build_config(

    campaign: Campaign,
    response_schema: type[BaseModel],
) -> types.GenerateContentConfig:
    """Build the generation config with file search (if available) and structured output."""
    tools: list[Any] = []
    system = SYSTEM_INSTRUCTION_NO_RULES

    if campaign.ruleset_store_name:
        tools.append(get_file_search_tool(campaign.ruleset_store_name))
        system = SYSTEM_INSTRUCTION

    if tools:
        import json
        schema_json = json.dumps(response_schema.model_json_schema(), indent=2)
        system += f"\n\nIMPORTANT: You must return ONLY raw JSON that strictly conforms to this schema:\n```json\n{schema_json}\n```\nDo not include markdown blocks or other text."
        return types.GenerateContentConfig(
            system_instruction=system,
            tools=tools,
        )

    return types.GenerateContentConfig(
        system_instruction=system,
        tools=None,
        response_mime_type="application/json",
        response_json_schema=response_schema.model_json_schema(),
    )



T = TypeVar("T", bound=BaseModel)

def generate_with_retry(
    campaign: Campaign,
    full_prompt: str,
    response_schema: type[T],
) -> T:
    client = get_client()
    config = _build_config(campaign, response_schema)
    max_retries = 3
    current_prompt = full_prompt

    for attempt in range(max_retries):
        response = client.models.generate_content(
            model=_get_reasoning_model(),
            contents=current_prompt,
            config=config,
        )
        text = _clean_json(response.text)
        try:
            return response_schema.model_validate_json(text)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"JSON validation failed on final attempt:\n{text}")
                raise
            current_prompt += f"\n\nERROR: The JSON you returned was invalid: {e}\nPlease fix the JSON. Use proper escaping for quotes. Return ONLY raw valid JSON."
    
    raise ValueError("Max retries exceeded without returning")

def generate_session(
    campaign: Campaign,
    prompt: str,
    session_number: int | None = None,
    extra_context: str = "",
    selected_npc_ids: list[str] | None = None,
    selected_location_ids: list[str] | None = None,
    selected_plot_thread_ids: list[str] | None = None,
) -> GeneratedSession:
    """Generate a full session plan grounded in campaign context and rulesets."""
    context = build_campaign_context(campaign)

    next_num = session_number or (len(campaign.sessions) + 1)

    constraint_parts = []
    if selected_npc_ids:
        npcs = [n for n in campaign.npcs if n.id in selected_npc_ids]
        if npcs:
            constraint_parts.append("**MANDATORY NPCs TO FEATURE:**\n" + "\n".join(f"- {n.name}: {n.description}" for n in npcs))
    if selected_location_ids:
        locs = [loc for loc in campaign.locations if loc.id in selected_location_ids]
        if locs:
            constraint_parts.append("**MANDATORY LOCATIONS TO FEATURE:**\n" + "\n".join(f"- {loc.name}: {loc.description}" for loc in locs))
    if selected_plot_thread_ids:
        plots = [p for p in campaign.plot_threads if p.id in selected_plot_thread_ids]
        if plots:
            constraint_parts.append("**MANDATORY PLOT THREADS TO ADVANCE:**\n" + "\n".join(f"- {p.title}: {p.description}" for p in plots))

    constraints_text = "\n\n".join(constraint_parts)

    full_prompt = f"""{context}

---

## Generation Request
Generate a detailed plan for **Session {next_num}** of this campaign.

**GM's Direction:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

{constraints_text}

Include vivid read-aloud text, NPC dialogue, encounter details (with accurate stats from the ruleset),
and connections to existing plot threads where appropriate. The plan should be detailed enough
to run directly at the table.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedSession)


def generate_npc(campaign: Campaign, prompt: str, role: NPCRole | None = None, extra_context: str = "") -> GeneratedNPC:
    """Generate an NPC with verified stats."""
    context = build_campaign_context(campaign)

    role_hint = f" Their role should be: {role.value}." if role else ""
    full_prompt = f"""{context}

---

## Generation Request
Create a detailed NPC for this campaign.{role_hint}

**GM's Direction:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

Include a vivid physical description, personality traits, mannerisms, background,
motivations, and secrets. If the game system is specified and rulesets are available,
include an accurate stat block from the ruleset.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedNPC)


def generate_encounter(
    campaign: Campaign,
    prompt: str,
    party_level: int | None = None,
    party_size: int | None = None,
    difficulty: str | None = None,
    extra_context: str = "",
) -> GeneratedEncounter:
    """Generate a combat or social encounter with verified stats."""
    context = build_campaign_context(campaign)

    party_info = ""
    if party_level:
        party_info += f" Party level: {party_level}."
    if party_size:
        party_info += f" Party size: {party_size}."
    if difficulty:
        party_info += f" Target difficulty: {difficulty}."

    full_prompt = f"""{context}

---

## Generation Request
Design an encounter for this campaign.{party_info}

**GM's Direction:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

Use the ruleset to look up accurate monster/enemy stats, calculate difficulty
using the system's encounter-building rules, and suggest appropriate treasure.
Include tactical notes for how enemies will behave.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedEncounter)


def generate_location(campaign: Campaign, prompt: str, extra_context: str = "") -> GeneratedLocation:
    """Generate a location description."""
    context = build_campaign_context(campaign)

    full_prompt = f"""{context}

---

## Generation Request
Create a detailed location for this campaign.

**GM's Direction:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

Include vivid sensory descriptions, notable features, possible encounters,
and adventure hooks tied to the campaign's existing plot threads.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedLocation)


def ask_rules(campaign: Campaign, question: str) -> RuleAnswer:
    """Query the ruleset directly. Returns verified answer with citations."""
    if not campaign.ruleset_store_name:
        return RuleAnswer(
            answer="No ruleset PDFs have been uploaded for this campaign. Please upload your ruleset PDFs first.",
            sources=[],
            confidence="unverified",
        )

    full_prompt = f"""## Rules Question
**Game System:** {campaign.game_system or 'Not specified'}

**Question:** {question}

Search the ruleset thoroughly and provide a precise answer with exact citations.
If the answer cannot be found in the provided materials, say so explicitly.
"""

    return generate_with_retry(campaign, full_prompt, RuleAnswer)


def generate_module(campaign: Campaign, prompt: str, title: str | None = None, extra_context: str = "") -> GeneratedModule:
    """Generate a full adventure module with section breakdowns."""
    context = build_campaign_context(campaign)

    full_prompt = f"""{context}

---

## Module Generation Request
Create a detailed adventure module for this campaign.

{f"**Module Title:** {title}" if title else ""}
**GM's Direction:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

Structure the module with clear sections: introduction, key scenes/encounters,
important NPCs, locations, and an appendix with stat blocks and reference tables.
For each section, provide an illustration_prompt that describes the ideal artwork
for that section (fantasy illustration style). Use the ruleset to verify all
mechanics, stats, and rules referenced in the module.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedModule)


def enhance_npc(campaign: Campaign, npc_data: str, guidance_prompt: str | None = None) -> GeneratedNPC:
    context = build_campaign_context(campaign)
    guidance = f"\n**GM's Guidance for this enhancement:** {guidance_prompt}" if guidance_prompt else ""
    full_prompt = f"""{context}
---
## Enhance NPC Request
Enhance the following NPC. Add more detail, personality, background, and game-system stats (if rulesets are available).
{guidance}

Original NPC Data:
{npc_data}
"""
    return generate_with_retry(campaign, full_prompt, GeneratedNPC)


def enhance_location(campaign: Campaign, location_data: str, guidance_prompt: str | None = None) -> GeneratedLocation:
    context = build_campaign_context(campaign)
    guidance = f"\n**GM's Guidance for this enhancement:** {guidance_prompt}" if guidance_prompt else ""
    full_prompt = f"""{context}
---
## Enhance Location Request
Enhance the following Location. Add more vivid descriptions, points of interest, hidden secrets, and adventure hooks.
{guidance}

Original Location Data:
{location_data}
"""
    return generate_with_retry(campaign, full_prompt, GeneratedLocation)


def enhance_plot_thread(campaign: Campaign, plot_data: str, guidance_prompt: str | None = None) -> GeneratedPlotThread:
    context = build_campaign_context(campaign)
    guidance = f"\n**GM's Guidance for this enhancement:** {guidance_prompt}" if guidance_prompt else ""
    full_prompt = f"""{context}
---
## Enhance Plot Thread Request
Enhance the following Plot Thread. Flesh out its developments, introduce new twists, outline potential resolutions, and tie it to existing NPCs and locations.
{guidance}

Original Plot Thread Data:
{plot_data}
"""
    return generate_with_retry(campaign, full_prompt, GeneratedPlotThread)


def enhance_session(campaign: Campaign, session_data: str, guidance_prompt: str | None = None) -> GeneratedSession:
    context = build_campaign_context(campaign)
    guidance = f"\n**GM's Guidance for this enhancement:** {guidance_prompt}" if guidance_prompt else ""
    full_prompt = f"""{context}
---
## Enhance Session Request
Enhance the following Session plan. Add more detail, vivid descriptions, read-aloud text, encounter specifics, and tie-ins to existing campaign elements.
{guidance}

Original Session Data:
{session_data}
"""
    return generate_with_retry(campaign, full_prompt, GeneratedSession)


def generate_art_prompt(campaign: Campaign, entity_description: str) -> str:
    """Use a reasoning model as an Art Director to create a vivid image prompt."""
    context = build_campaign_context(campaign)

    full_prompt = f"""
Act as a Lead Art Director for a TTRPG campaign. Your job is to transform a simple character or location description into a high-fidelity, stylistically consistent prompt for a professional image generator (like Imagen 3).

### Campaign Context
{context}

### Entity Description
{entity_description}

### Instructions
1.  Study the campaign setting and tone (e.g., Grimdark, High Fantasy, Cyberpunk).
2.  Synthesize the visual aesthetic of the setting with the specific details of the entity.
3.  Include specific details about lighting (e.g., "dramatic chiaroscuro", "ethereal bioluminescence"), composition (e.g., "low angle heroic portrait", "atmospheric wide shot"), and intricate textures.
4.  Avoid generic buzzwords. Use evocative, artistic language.
5.  Maintain a "fantasy character portrait" or "atmospheric location concept art" style as appropriate.

Return only the final image generation prompt.
"""
    result = generate_with_retry(campaign, full_prompt, ArtDirectorPrompt)
    return result.prompt


def generate_illustration(prompt: str, style: str = "fantasy illustration, detailed, dramatic lighting") -> bytes | None:
    """
    Generate an illustration using Gemini's image generation model.

    Returns raw image bytes (PNG), or None if generation fails.
    """
    client = get_client()

    try:
        response = client.models.generate_images(
            model=_get_image_model(),
            prompt=f"{style}: {prompt}",
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
            ),
        )

        if response.generated_images and response.generated_images[0].image:
            return response.generated_images[0].image.image_bytes

    except Exception as e:
        logger.warning("Image generation failed: %s", e)

    return None



ADVERSARY_TEMPLATES = {
    AdversaryType.HEAVY_HITTER: [
        "Intro HEAVY HITTER to characters",
        "Characters learn about HEAVY HITTER",
        "Characters learn HEAVY HITTER has a big goal",
        "Characters battle HEAVY HITTER's minions",
        "Characters battle HEAVY HITTER"
    ],
    AdversaryType.RACER: [
        "Characters learn of the race",
        "Characters slowed by RACER or their NPCs",
        "Characters learn about the RACER",
        "Characters must reach the goal",
        "Characters prevent or beat the RACER"
    ],
    AdversaryType.CHASER: [
        "Characters gain a valuable thing",
        "Characters escape from CHASER",
        "Characters learn why CHASER wants the thing",
        "Characters must reach goal",
        "Characters defeat CHASER's goal"
    ],
    AdversaryType.SHADOW: [
        "Characters have no idea of SHADOW (something is not right)",
        "Characters discover bigger plot",
        "Characters learn of SHADOW",
        "Characters track down SHADOW",
        "Characters defeat SHADOW"
    ]
}


def generate_adversary(
    campaign: Campaign,
    prompt: str,
    adventure_type: AdventureType,
    adversary_type: AdversaryType,
    extra_context: str = "",
    selected_npc_ids: list[str] | None = None,
    selected_location_ids: list[str] | None = None,
    selected_plot_thread_ids: list[str] | None = None,
) -> GeneratedAdversary:
    """Generate a primary adversary with a 5-step master plan."""
    context = build_campaign_context(campaign)
    template = ADVERSARY_TEMPLATES.get(adversary_type, [])
    template_str = "\n".join([f"{i+1}. {step}" for i, step in enumerate(template)])

    constraint_parts = []
    if selected_npc_ids:
        npcs = [n for n in campaign.npcs if n.id in selected_npc_ids]
        if npcs:
            constraint_parts.append("**MANDATORY NPCs TO CONNECT:**\n" + "\n".join(f"- {n.name}" for n in npcs))
    if selected_location_ids:
        locs = [loc for loc in campaign.locations if loc.id in selected_location_ids]
        if locs:
            constraint_parts.append("**MANDATORY LOCATIONS TO CONNECT:**\n" + "\n".join(f"- {loc.name}" for loc in locs))
    if selected_plot_thread_ids:
        plots = [p for p in campaign.plot_threads if p.id in selected_plot_thread_ids]
        if plots:
            constraint_parts.append("**MANDATORY PLOT THREADS TO CONNECT:**\n" + "\n".join(f"- {p.title}" for p in plots))

    constraints_text = "\n\n".join(constraint_parts)

    full_prompt = f"""{context}

---

## Adversary Generation Request
Create a primary adversary for this campaign.

**Adventure Type:** {adventure_type.value}
**Adversary Type:** {adversary_type.value}

**GM's Prompt:** {prompt}

{f"**Additional Context:** {extra_context}" if extra_context else ""}

{constraints_text}

## Required Template to Flesh Out
You MUST provide exactly 5 steps (story beats) for this adversary's master plan, based on this template:
{template_str}

Flesh out these steps with specific details relevant to the campaign setting and the GM's prompt.
"""

    return generate_with_retry(campaign, full_prompt, GeneratedAdversary)
