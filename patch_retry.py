import re

file_path = r"c:\Tools\ai-gm-assistant\src\generator.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add generate_with_retry before generate_session
retry_code = """
def generate_with_retry(
    campaign: Campaign,
    full_prompt: str,
    response_schema: type[BaseModel],
):
    client = _get_client()
    config = _build_config(campaign, response_schema)
    max_retries = 3
    current_prompt = full_prompt
    
    for attempt in range(max_retries):
        response = client.models.generate_content(
            model=REASONING_MODEL,
            contents=current_prompt,
            config=config,
        )
        text = _clean_json(response.text)
        try:
            return response_schema.model_validate_json(text)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"JSON validation failed on final attempt:\\n{text}")
                raise
            current_prompt += f"\\n\\nERROR: The JSON you returned was invalid: {e}\\nPlease fix the JSON. Use proper escaping for quotes. Return ONLY raw valid JSON."

def generate_session(
"""

content = content.replace("def generate_session(\n", retry_code)

# Now, we need to replace the boilerplate in each generate function.
# Boilerplate pattern:
#     config = _build_config(campaign, ResponseClassName)
#     response = client.models.generate_content(
#         model=REASONING_MODEL,
#         contents=full_prompt,
#         config=config,
#     )
#     return ResponseClassName.model_validate_json(_clean_json(response.text))

# Let's use regex to replace it!
pattern = r"    config = _build_config\(campaign, ([a-zA-Z]+)\)\s+response = client\.models\.generate_content\(\s+model=REASONING_MODEL,\s+contents=full_prompt,\s+config=config,?\s+\)\s+return \1\.model_validate_json\(_clean_json\(response\.text\)\)"
replacement = r"    return generate_with_retry(campaign, full_prompt, \1)"

# Wait, `ask_rules` doesn't use `_build_config`.
# For `ask_rules`:
ask_rules_pattern = r"    config = types\.GenerateContentConfig\([\s\S]+?model_json_schema\(\),\s+\)\s+response = client\.models\.generate_content\(\s+model=REASONING_MODEL,\s+contents=full_prompt,\s+config=config,\s+\)\s+return RuleAnswer\.model_validate_json\(_clean_json\(response\.text\)\)"
# If ask_rules relies on tools AND response_mime_type, it will FAIL on 2.5 Flash too!!
# I must convert `ask_rules` to use `_build_config`!
ask_rules_replacement = r"    return generate_with_retry(campaign, full_prompt, RuleAnswer)"

content = re.sub(pattern, replacement, content)
content = re.sub(ask_rules_pattern, ask_rules_replacement, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Retry patch applied!")
