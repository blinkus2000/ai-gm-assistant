# SQLite Migration Plan: JSON to Database

This document outlines the precise work required to migrate the AI GM Assistant backend from single-file JSON storage to a proper SQLite database architecture.

## 1. Database Schema Design
Design an SQLite schema that supports the existing campaign entity structure. 
Use foreign keys to relate entities back to their parent campaign. 
For list-based properties (like `npcs_involved` array on a session, or the `stats` object), store them as `TEXT` using SQLite's JSON functions, or create dedicated junction tables. To keep the initial migration scope manageable, using `TEXT` for JSON arrays/objects is acceptable if properly parsed by the application tier.

**Proposed Tables:**
- `campaigns`: id (PK), name, game_system, setting, ruleset_store_name, notes, created_at, updated_at
- `rulesets`: id (PK, auto), campaign_id (FK), file_name, display_name, gemini_file_name, uploaded_at
- `sessions`: id (PK), campaign_id (FK), number, title, summary, plan, npcs_involved (JSON), locations_visited (JSON), plot_developments (JSON), key_events (JSON), status, notes, created_at, updated_at
- `npcs`: id (PK), campaign_id (FK), name, description, role, stats (JSON TEXT), notes, image_path, created_at
- `locations`: id (PK), campaign_id (FK), name, description, points_of_interest (JSON), hooks (JSON), notes, image_path, created_at
- `plot_threads`: id (PK), campaign_id (FK), title, description, status, related_npcs (JSON), related_locations (JSON), related_sessions (JSON), notes, created_at
- `adversaries`: id (PK), campaign_id (FK), name, description, adventure_type, adversary_type, steps (JSON), notes, image_path, created_at
- `factions`: id (PK), campaign_id (FK), name, description, members (JSON), notes, created_at

## 2. Python Migration Script (`migrate_to_sqlite.py`)
Build a standalone Python script to execute the migration.
1. **Backup**: Ensure the script copies the `data/campaigns/` folder to `data/campaigns_backup/` before starting, providing a rollback safety net.
2. **Initialize DB**: Connect to `data/app.db` (create if it doesn't exist) and execute the table creation schemas.
3. **Read Files**: Iterate through all `.json` files in `data/campaigns/`.
4. **Parse & Insert**:
    - For each campaign JSON, insert the top-level campaign data into the `campaigns` table.
    - Iterate through the nested arrays (`sessions`, `npcs`, `locations`, `adversaries`, `plot_threads`, etc.) and insert each item into its respective table, ensuring `campaign_id` is set as the foreign key.
    - Transform arrays/objects into JSON strings before insertion where appropriate.
5. **Pagination Support**: As part of replacing the data layer, ensure all list endpoints (e.g. `GET /api/campaigns/<id>/npcs`) support `limit` and `offset` query parameters.

## 3. Data Integrity & Verification Plan
After the coders write and execute the script, the following exact verification plan **must** be executed, using the existing "Pacific Rim" campaign (`87d762646991`) as the benchmark.

### Automated Integrity Checks (Add to Script)
At the end of the script, write validation code to compare the old JSON exactly against the new DB:
- Count verification: `SELECT count(*) FROM npcs WHERE campaign_id = '87d762646991'` must equal the number of elements in the `npcs` array of `87d762646991.json` (6 NPCs).
- Do the same count for sessions (1), locations (4), plot_threads (2), and adversaries (1).
- Fetch the `Pacific Rim` campaign via the DB and assert that the `setting` text matches the original perfectly, preserving all newline `\n` characters.

### Manual Verification
1. Boot up the backend and frontend configured to use the new SQLite data layer.
2. Load the **"Pacific Rim"** campaign in the UI.
3. **Verify App Loads**: The dashboard should render without 500 API errors.
4. **Verify Rich Text**: Navigate to the session "Symphony of the Pacific" and ensure "Custom Keeper Moves", "The Countdown", and "Scenes" properly render markdown, meaning no data truncation occurred during DB insertion.
5. **Verify Relationships**: Check the "Symphony of the Pacific" session and ensure "Edgar Krumpf" and "Shamus Finnegan" still appear linked under the NPCs involved section (verifying JSON arrays were parsed correctly from the DB).
6. **Verify Images**: Check Shamus Finnegan's NPC card (ID: `0ac1fa3c77b3`) to ensure his image path `/images/87d762646991/npc_0ac1fa3c77b3_69dbd577.png` loads successfully, verifying image paths survived the migration.

Once this verification passes, the old JSON loader can be officially deprecated.
