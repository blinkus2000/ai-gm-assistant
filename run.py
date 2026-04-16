"""
Entry point — launch the AI GM Assistant server.

Works in both development mode (python run.py) and frozen mode
(PyInstaller executable).
"""

import logging
import multiprocessing
import sys
import webbrowser
import threading

import uvicorn


def _open_browser(port: int) -> None:
    """Open the default browser after a short delay to let the server start."""
    import time
    time.sleep(1.5)
    webbrowser.open(f"http://127.0.0.1:{port}")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

if __name__ == "__main__":
    # Required for Windows when bundled by PyInstaller
    multiprocessing.freeze_support()

    port = 8000

    # Import the app object directly for frozen compatibility.
    # String-based import ("src.server:app") breaks inside PyInstaller.
    from src.server import app

    frozen = getattr(sys, "frozen", False)

    if frozen:
        print("=" * 56)
        print("  AI GM Assistant is starting...")
        print(f"  Open your browser to: http://127.0.0.1:{port}")
        print("  Close this window to stop the server.")
        print("=" * 56)

    # Auto-open browser
    threading.Thread(target=_open_browser, args=(port,), daemon=True).start()

    if frozen:
        # Frozen mode: pass app object directly (string import breaks in PyInstaller)
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=port,
            reload=False,
        )
    else:
        # Dev mode: use string import so reload works (required by uvicorn 0.44+)
        uvicorn.run(
            "src.server:app",
            host="127.0.0.1",
            port=port,
            reload=True,
        )
