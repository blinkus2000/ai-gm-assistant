import sqlite3
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
CAMPAIGNS_DIR = DATA_DIR / "campaigns"
DB_PATH = DATA_DIR / "app.db"
BACKUP_DIR = DATA_DIR / "campaigns_backup"

def backup_data():
    print(f"Backing up {CAMPAIGNS_DIR} to {BACKUP_DIR}...")
    if BACKUP_DIR.exists():
        shutil.rmtree(BACKUP_DIR)
    shutil.copytree(CAMPAIGNS_DIR, BACKUP_DIR)
    print("Backup complete.")

def init_db(conn):
    print("Initializing Database Schema...")
    cursor = conn.cursor()
    
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            schema_version INTEGER DEFAULT 1,
            name TEXT NOT NULL,
            game_system TEXT,
            setting TEXT,
            ruleset_store_name TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS rulesets (
            file_name TEXT PRIMARY KEY,
            campaign_id TEXT,
            display_name TEXT,
            gemini_file_name TEXT,
            uploaded_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            number INTEGER,
            title TEXT,
            summary TEXT,
            plan TEXT,
            npcs_involved TEXT,
            locations_visited TEXT,
            plot_developments TEXT,
            key_events TEXT,
            status TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS npcs (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            role TEXT,
            stats TEXT,
            notes TEXT,
            image_path TEXT,
            created_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            points_of_interest TEXT,
            hooks TEXT,
            notes TEXT,
            image_path TEXT,
            created_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plot_threads (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT,
            related_npcs TEXT,
            related_locations TEXT,
            related_sessions TEXT,
            notes TEXT,
            created_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS adversaries (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            adventure_type TEXT,
            adversary_type TEXT,
            steps TEXT,
            notes TEXT,
            image_path TEXT,
            created_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS factions (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            goals TEXT,
            notable_members TEXT,
            notes TEXT,
            created_at TEXT,
            FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    print("Schema initialized.")

def dumps(obj):
    return json.dumps(obj) if obj is not None else "[]"

def migrate_campaign(conn, data):
    cur = conn.cursor()
    c_id = data["id"]
    
    print(f"Migrating Campaign: {data.get('name', c_id)}")
    
    # Insert Campaign
    cur.execute("""
        INSERT OR REPLACE INTO campaigns 
        (id, schema_version, name, game_system, setting, ruleset_store_name, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        c_id, 
        data.get("schema_version", 1), 
        data.get("name", ""), 
        data.get("game_system", ""), 
        data.get("setting", ""), 
        data.get("ruleset_store_name"), 
        data.get("notes", ""), 
        data.get("created_at", ""), 
        data.get("updated_at", "")
    ))
    
    # Rulesets
    for r in data.get("rulesets", []):
        cur.execute("""
            INSERT OR REPLACE INTO rulesets 
            (file_name, campaign_id, display_name, gemini_file_name, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
        """, (r.get("file_name"), c_id, r.get("display_name", ""), r.get("gemini_file_name"), r.get("uploaded_at", "")))
        
    # Sessions
    for s in data.get("sessions", []):
        cur.execute("""
            INSERT OR REPLACE INTO sessions 
            (id, campaign_id, number, title, summary, plan, npcs_involved, locations_visited, plot_developments, key_events, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s.get("id"), c_id, s.get("number", 0), s.get("title", ""), s.get("summary", ""), s.get("plan", ""),
            dumps(s.get("npcs_involved", [])), dumps(s.get("locations_visited", [])), dumps(s.get("plot_developments", [])), dumps(s.get("key_events", [])),
            s.get("status", "draft"), s.get("notes", ""), s.get("created_at", ""), s.get("updated_at", "")
        ))

    # NPCs
    for n in data.get("npcs", []):
        cur.execute("""
            INSERT OR REPLACE INTO npcs 
            (id, campaign_id, name, description, role, stats, notes, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            n.get("id"), c_id, n.get("name", ""), n.get("description", ""), n.get("role", "neutral"),
            dumps(n.get("stats", {})), n.get("notes", ""), n.get("image_path"), n.get("created_at", "")
        ))

    # Locations
    for l in data.get("locations", []):
        cur.execute("""
            INSERT OR REPLACE INTO locations 
            (id, campaign_id, name, description, points_of_interest, hooks, notes, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            l.get("id"), c_id, l.get("name", ""), l.get("description", ""), dumps(l.get("points_of_interest", [])), 
            dumps(l.get("hooks", [])), l.get("notes", ""), l.get("image_path"), l.get("created_at", "")
        ))

    # Plot Threads
    for p in data.get("plot_threads", []):
        cur.execute("""
            INSERT OR REPLACE INTO plot_threads 
            (id, campaign_id, title, description, status, related_npcs, related_locations, related_sessions, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            p.get("id"), c_id, p.get("title", ""), p.get("description", ""), p.get("status", "active"), 
            dumps(p.get("related_npcs", [])), dumps(p.get("related_locations", [])), dumps(p.get("related_sessions", [])), 
            p.get("notes", ""), p.get("created_at", "")
        ))

    # Adversaries
    for a in data.get("adversaries", []):
        cur.execute("""
            INSERT OR REPLACE INTO adversaries 
            (id, campaign_id, name, description, adventure_type, adversary_type, steps, notes, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            a.get("id"), c_id, a.get("name", ""), a.get("description", ""), a.get("adventure_type", "thwarting"), 
            a.get("adversary_type", "heavy_hitter"), dumps(a.get("steps", [])), a.get("notes", ""), a.get("image_path"), a.get("created_at", "")
        ))

    # Factions
    for f in data.get("factions", []):
        cur.execute("""
            INSERT OR REPLACE INTO factions 
            (id, campaign_id, name, description, goals, notable_members, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f.get("id"), c_id, f.get("name", ""), f.get("description", ""), f.get("goals", ""), 
            dumps(f.get("notable_members", [])), f.get("notes", ""), f.get("created_at", "")
        ))

    conn.commit()

def verify_integrity(conn):
    print("\nVerifying Data Integrity...")
    target_id = "87d762646991"
    target_file = CAMPAIGNS_DIR / f"{target_id}.json"
    
    if not target_file.exists():
        print(f"Skipping verification because {target_id}.json doesn't exist.")
        return True

    with open(target_file, "r", encoding="utf-8") as f:
        original = json.load(f)

    cur = conn.cursor()
    
    def check_count(table, json_key):
        cur.execute(f"SELECT count(*) FROM {table} WHERE campaign_id = ?", (target_id,))
        db_count = cur.fetchone()[0]
        json_count = len(original.get(json_key, []))
        if db_count != json_count:
            print(f"FAILED: {table} count mismatch. Expected {json_count}, got {db_count}.")
            return False
        return True

    passing = True
    passing = passing and check_count("npcs", "npcs")
    passing = passing and check_count("sessions", "sessions")
    passing = passing and check_count("locations", "locations")
    passing = passing and check_count("plot_threads", "plot_threads")
    passing = passing and check_count("adversaries", "adversaries")
    passing = passing and check_count("factions", "factions")

    cur.execute("SELECT setting FROM campaigns WHERE id = ?", (target_id,))
    row = cur.fetchone()
    if not row or row[0] != original.get("setting"):
        print("FAILED: Setting text mismatch.\nExpected:\n" + original.get("setting") + "\n\nGot:\n" + (row[0] if row else "None"))
        passing = False

    if passing:
        print("INTEGRITY CHECK PASSED: The new SQLite db mirrors the JSON structure accurately.")
    else:
        print("INTEGRITY CHECK FAILED!")
    return passing

def main():
    if not CAMPAIGNS_DIR.exists():
        print(f"Error: {CAMPAIGNS_DIR} does not exist.")
        sys.exit(1)

    backup_data()

    print(f"Connecting to {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    for json_file in CAMPAIGNS_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            migrate_campaign(conn, data)
        except Exception as e:
            print(f"Failed to process {json_file}: {e}")

    verify_integrity(conn)
    conn.close()

if __name__ == "__main__":
    main()
