import re

# Patch index.html
html_path = r"c:\Tools\ai-gm-assistant\static\index.html"
with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace('src="/static/app.js"', 'src="/static/app.js?v=2"')
with open(html_path, "w", encoding="utf-8") as f:
    f.write(text)

# Patch server.py
server_path = r"c:\Tools\ai-gm-assistant\src\server.py"
with open(server_path, "r", encoding="utf-8") as f:
    s = f.read()

# Pattern for enhance_npc
s = re.sub(
    r"(\s+result = generator\.enhance_npc\(campaign, npc\.model_dump_json\(\)\)\s+)return result\.model_dump\(\)",
    r"\1try:\n        npc.role = NPCRole(result.role)\n    except:\n        pass\n    npc.description = result.description\n    if result.stats:\n        npc.stats = result.stats\n    if result.notes:\n        npc.notes = result.notes\n    campaign.updated_at = _now()\n    storage.save_campaign(campaign)\n    return result.model_dump()",
    s, count=1
)

# Pattern for enhance_location
s = re.sub(
    r"(\s+result = generator\.enhance_location\(campaign, loc\.model_dump_json\(\)\)\s+)return result\.model_dump\(\)",
    r"\1loc.description = result.description\n    if result.points_of_interest:\n        loc.points_of_interest = result.points_of_interest\n    if result.hooks:\n        loc.hooks = result.hooks\n    if result.notes:\n        loc.notes = result.notes\n    campaign.updated_at = _now()\n    storage.save_campaign(campaign)\n    return result.model_dump()",
    s, count=1
)

# Pattern for enhance_plot_thread
s = re.sub(
    r"(\s+result = generator\.enhance_plot_thread\(campaign, plot\.model_dump_json\(\)\)\s+)return result\.model_dump\(\)",
    r"\1plot.description = result.description\n    if result.notes:\n        plot.notes = result.notes\n    campaign.updated_at = _now()\n    storage.save_campaign(campaign)\n    return result.model_dump()",
    s, count=1
)

with open(server_path, "w", encoding="utf-8") as f:
    f.write(s)

print("Patch applied to index.html and server.py!")
