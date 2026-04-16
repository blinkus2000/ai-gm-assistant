"""
Ruleset Manager — handles PDF upload and Gemini File Search Store integration.

Uploads ruleset PDFs to Gemini's File Search API, which indexes them for
retrieval-augmented generation. This is the backbone of rule verification:
every generation call can search these stores to ground output in actual rules.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from google.genai import types

from .gemini_client import get_client
from .models import RulesetInfo

logger = logging.getLogger(__name__)


def create_ruleset_store(campaign_name: str) -> str:
    """
    Create a new File Search Store for a campaign's rulesets.

    Returns the store name (ID) to be saved on the Campaign model.
    """
    client = get_client()
    store = client.file_search_stores.create(
        config={"display_name": f"gm-assistant-{campaign_name}"}
    )
    logger.info("Created File Search Store: %s", store.name)
    return store.name or ""


def upload_ruleset_pdf(
    store_name: str,
    pdf_path: str | Path,
    display_name: str,
    poll_interval: float = 5.0,
    max_wait: float = 300.0,
) -> RulesetInfo:
    """
    Upload a PDF to the File Search Store and wait for indexing to complete.

    Args:
        store_name: Gemini File Search Store name/ID.
        pdf_path: Local path to the PDF file.
        display_name: Human-readable name for the ruleset.
        poll_interval: Seconds between polling for completion.
        max_wait: Maximum seconds to wait for indexing.

    Returns:
        RulesetInfo with metadata about the uploaded file.
    """
    client = get_client()
    pdf_path = Path(pdf_path)

    logger.info("Uploading %s to store %s ...", pdf_path.name, store_name)

    operation = client.file_search_stores.upload_to_file_search_store(
        file=str(pdf_path),
        file_search_store_name=store_name,
        config={"display_name": display_name},
    )

    # Poll until the upload/indexing is done
    elapsed = 0.0
    while not operation.done:
        if elapsed >= max_wait:
            logger.warning("Timed out waiting for indexing of %s", display_name)
            break
        time.sleep(poll_interval)
        elapsed += poll_interval
        operation = client.operations.get(operation=operation)
        logger.debug("Indexing %s … elapsed %.0fs", display_name, elapsed)

    logger.info("Ruleset '%s' indexed successfully.", display_name)

    return RulesetInfo(
        file_name=pdf_path.name,
        display_name=display_name,
        gemini_file_name=store_name,
    )


def delete_ruleset_store(store_name: str) -> None:
    """Delete a File Search Store (and all its indexed files)."""
    try:
        client = get_client()
        client.file_search_stores.delete(name=store_name)
        logger.info("Deleted File Search Store: %s", store_name)
    except Exception as e:
        logger.warning("Failed to delete store %s: %s", store_name, e)


def get_file_search_tool(store_name: str) -> types.Tool:
    """
    Build the file_search Tool config to pass into generate_content.

    This is what grounds the model's output in the actual ruleset PDFs.
    """
    return types.Tool(
        file_search=types.FileSearch(
            file_search_store_names=[store_name]
        )
    )
