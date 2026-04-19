# CLAUDE.md

Working notes for AI agents (Claude / Cowork) on this repo. Keep this concise and current.

## What this project is

Browser-based AI-backed Game Master assistant for tabletop RPGs. Users import PDF rulesets for any game system; the app uses Gemini File Search (RAG) to ground generation in those rulebooks. Tracks campaigns, sessions, NPCs, locations, factions, plot threads, adversaries, and exports illustrated PDF modules.

Runs as a local FastAPI server on `http://127.0.0.1:8000`, with a vanilla-JS single-page frontend.

## Stack

- Backend: Python 3.10+, FastAPI 0.135.x, Uvicorn, Pydantic v2
- AI: `google-genai` ~1.60 (Gemini reasoning + Imagen image gen + File Search Stores for RAG)
- Storage: SQLite (`data/app.db`) via `src/storage.py`; settings in `data/settings.json`
- PDF export: `fpdf2` via `src/pdf_builder.py`, template at `templates/module.html`
- Frontend: vanilla HTML/CSS/JS SPA in `static/` — no build step
- Tests: pytest + pytest-asyncio + httpx TestClient
- Lint/format/typecheck: ruff + mypy (configured in `pyproject.toml`)

## Repo layout

```
run.py                      Entry point — uvicorn on 127.0.0.1:8000, opens browser
service.ps1                 Windows PowerShell start/stop/status wrapper (PID -> service.pid)
migrate_to_sqlite.py        One-shot JSON-campaigns -> SQLite migration (defines schema)
test_db.py                  Quick local sanity script (lists campaigns)

src/
  server.py                 FastAPI app + REST endpoints (campaigns, NPCs, locations,
                            sessions, rulesets, generation, module export)
  models.py                 Pydantic schemas + enums (NPCRole, SessionStatus, etc.)
  storage.py                SQLite persistence layer
  generator.py              Gemini generation (sessions, NPCs, encounters, adversaries,
                            rules Q&A) — RAG via File Search
  ruleset_manager.py        Wraps Gemini File Search Store API for PDF ingestion
  gemini_client.py          Singleton genai.Client (picks up GEMINI_API_KEY / GOOGLE_API_KEY)
  pdf_builder.py            fpdf2 module export + image embedding
  paths.py                  Dev vs PyInstaller-frozen path resolution

static/                     Frontend SPA
  index.html, styles.css, libs/ (marked.min.js)
  js/  api.js, main.js, state.js, utils.js,
       components/Sidebar.js,
       views/{Dashboard,Campaign,CampaignCRUD,CampaignGenerate,Settings}.js

templates/module.html       PDF export template
data/                       Runtime data (gitignored): app.db, settings.json,
                            campaigns/, rulesets/<campaign_id>/, images/<campaign_id>/,
                            modules/
tests/                      conftest.py mocks Gemini client + tmp data dirs;
                            test_{server,generator,storage,models}.py
installer/                  PyInstaller + Inno Setup build artifacts (installer/build/ huge)
.agents/rules/              Project agent rules (gitignored)
.github/workflows/          CI
```

## Run / dev commands

```bash
# Install
pip install -r requirements.txt -r requirements-dev.txt
# Run dev server (auto-reload, opens browser to http://127.0.0.1:8000)
python run.py
# Windows background service
.\service.ps1 start | stop | restart | status

# Tests
pytest                            # full suite
pytest tests/test_server.py -v    # single file
pytest -k "test_create_campaign"  # by name

# Lint / typecheck
ruff check .
ruff format .
mypy src
```

## Required env

- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) — read by `google-genai` via `python-dotenv`. Put in a `.env` at repo root for dev. No `.env` is committed.
- Models are configured in `data/settings.json` (`reasoning_model`, `image_model`) and editable via the in-app Settings view.

## Working rules (from `.agents/rules/when-editing-code.md`)

> Always check linting, always run tests; make sure nothing is broken with changes.

After any code edit:
1. `ruff check .` (and `ruff format .` if formatting drifted)
2. `pytest` — must stay green
3. For type-sensitive changes in `src/`, run `mypy src`

If a change touches generator prompts, schemas, or API contracts, also update the matching test in `tests/`.

## Conventions

- Type hints everywhere in `src/`. Pydantic v2 models for all wire formats.
- Imports inside `src/` use relative imports (`from . import generator`); tests/run.py use absolute (`from src.server import app`).
- Ruff line length 120; rules selected: E, W, F, I, B, UP, RUF (see `pyproject.toml`).
- Pydantic schemas live in `models.py`; generation-only schemas (e.g. `GeneratedSession`) live alongside the prompt in `generator.py`.
- Frontend is plain ES modules — no bundler. Add new views under `static/js/views/` and wire into `main.js`.
- Never commit anything under `data/`, `.env`, `service.log`, `service.pid`, or `installer/build/` (already in `.gitignore`).

## Known gotchas / open issues

- **CRLF noise in `git status`**: working tree currently shows 4 modified files (`src/generator.py`, `src/server.py`, `static/index.html`, `static/js/views/CampaignCRUD.js`) where every line is "changed" — these are LF→CRLF line-ending flips, not real edits. Resolve once via `.gitattributes` (`* text=auto eol=lf`) and a re-checkout, or by setting `core.autocrlf=input`. Don't commit these as content changes.
- **Uvicorn over-reloads in dev**: `service.log` shows `StatReload` firing on `site-packages` changes. Cosmetic; ignore unless it actually slows iteration.
- **No favicon** — 404 on `/favicon.ico` in logs. Drop one in `static/` to silence.
- **Old JSON campaigns** in `data/campaigns/` may predate the SQLite migration; `data/campaigns_backup/` is the pre-migration snapshot.
- **`sample rulesets/` is empty** — either populate with a sample PDF for quickstart or remove.
- **`google.genai.errors`** is imported in `server.py`; ensure error handling stays in sync with the SDK version pinned in `requirements.txt`.

## Cowork sandbox limitation (read this before trying to run things)

The Linux sandbox available to the agent **cannot reach PyPI** (proxy returns 403). That means `pip install` fails inside the sandbox, so `pytest`, `ruff`, and `mypy` cannot be executed there. To validate changes:
- The user runs `pytest` / `ruff` / `mypy` on their Windows machine (where deps are already installed), OR
- The agent does static review only (read code, reason about changes) and asks the user to run the checks.

Do not promise "tests pass" based on sandbox runs unless the tooling actually executed. Static review is fine; just label it as such.

## Quick-start checklist for a new task

1. Read this file and the relevant files in `src/` or `static/js/views/`.
2. Make the change.
3. Ask the user to run `ruff check . && pytest` (or run it yourself if tooling becomes available).
4. Update tests in `tests/` when behavior changes.
5. Don't touch the 4 CRLF-only modified files unless intentionally fixing the line-ending issue.
