"""
Shared Gemini API client singleton.

Ensures that the application uses a single connection/client instance
for all Gemini API requests to minimize instantiation overhead.
"""

from __future__ import annotations

from google import genai

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Return a shared singleton instance of the GenAI client."""
    global _client
    if _client is None:
        _client = genai.Client()
    return _client
