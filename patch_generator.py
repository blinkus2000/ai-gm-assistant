import re

file_path = r"c:\Tools\ai-gm-assistant\src\generator.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert _clean_json helper before _build_config
clean_json_code = """
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
"""

content = content.replace("def _build_config(", clean_json_code)

# 2. Update _build_config
old_config = """    return types.GenerateContentConfig(
        system_instruction=system,
        tools=tools if tools else None,
        response_mime_type="application/json",
        response_json_schema=response_schema.model_json_schema(),
    )"""

new_config = """    if tools:
        import json
        schema_json = json.dumps(response_schema.model_json_schema(), indent=2)
        system += f"\\n\\nIMPORTANT: You must return ONLY raw JSON that strictly conforms to this schema:\\n```json\\n{schema_json}\\n```\\nDo not include markdown blocks or other text."
        return types.GenerateContentConfig(
            system_instruction=system,
            tools=tools,
        )

    return types.GenerateContentConfig(
        system_instruction=system,
        tools=None,
        response_mime_type="application/json",
        response_json_schema=response_schema.model_json_schema(),
    )"""

content = content.replace(old_config, new_config)

# 3. Replace `.model_validate_json(response.text or "{}")`
content = content.replace(".model_validate_json(response.text or \"{}\")", ".model_validate_json(_clean_json(response.text))")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
