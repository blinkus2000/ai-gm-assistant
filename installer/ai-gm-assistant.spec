# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for AI GM Assistant.

Builds a one-directory bundle containing the FastAPI server,
all Python dependencies, and the static frontend assets.

Usage:
    pyinstaller installer/ai-gm-assistant.spec
"""

import os
import sys

block_cipher = None

# Paths relative to the project root (spec file is in installer/)
PROJECT_ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

a = Analysis(
    [os.path.join(PROJECT_ROOT, "run.py")],
    pathex=[PROJECT_ROOT],
    binaries=[],
    datas=[
        # Bundle the frontend static files
        (os.path.join(PROJECT_ROOT, "static"), "static"),
        # Bundle HTML templates
        (os.path.join(PROJECT_ROOT, "templates"), "templates"),
    ],
    hiddenimports=[
        # FastAPI / Starlette / Uvicorn internals that PyInstaller misses
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "fastapi",
        "fastapi.responses",
        "fastapi.staticfiles",
        "starlette.responses",
        "starlette.staticfiles",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        "anyio._backends._asyncio",
        "multipart",
        "multipart.multipart",
        # Google GenAI
        "google.genai",
        "google.genai.errors",
        # Pydantic
        "pydantic",
        "pydantic_core",
        # PDF generation
        "fpdf",
        "fpdf.enums",
        # Dotenv
        "dotenv",
        # Application modules
        "src",
        "src.server",
        "src.models",
        "src.generator",
        "src.storage",
        "src.paths",
        "src.pdf_builder",
        "src.ruleset_manager",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "scipy",
        "PIL",
        "pytest",
        "mypy",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AIGMAssistant",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Show console window so user sees server status
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon=os.path.join(PROJECT_ROOT, "installer", "icon.ico"),  # Uncomment when icon exists
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AIGMAssistant",
)
