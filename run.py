"""
Entry point — launch the AI GM Assistant server.
"""

import logging
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

if __name__ == "__main__":
    uvicorn.run(
        "src.server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
