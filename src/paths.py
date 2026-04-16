"""
Centralized path resolution for the AI GM Assistant.

Handles two modes:
  - Development: paths resolve relative to the project root on disk.
  - Frozen (PyInstaller): bundled assets come from sys._MEIPASS,
    while user data is stored in %LOCALAPPDATA%/AIGMAssistant/data.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    """Return True when running inside a PyInstaller bundle."""
    return getattr(sys, "frozen", False)


def get_base_dir() -> Path:
    """
    Return the base directory for bundled *assets* (static, templates).

    - Dev: project root  (e.g. c:/Tools/ai-gm-assistant)
    - Frozen: the temporary extraction folder (sys._MEIPASS)
    """
    if is_frozen():
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent


def get_data_dir() -> Path:
    """
    Return the directory where user-generated data lives (campaigns,
    images, rulesets, modules, settings).

    - Dev: <project_root>/data
    - Frozen: %LOCALAPPDATA%/AIGMAssistant/data
    """
    if is_frozen():
        local_app = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        data = Path(local_app) / "AIGMAssistant" / "data"
    else:
        data = get_base_dir() / "data"
    data.mkdir(parents=True, exist_ok=True)
    return data


def get_static_dir() -> Path:
    """Return the directory containing the frontend static files."""
    return get_base_dir() / "static"


def get_templates_dir() -> Path:
    """Return the directory containing HTML templates."""
    return get_base_dir() / "templates"
