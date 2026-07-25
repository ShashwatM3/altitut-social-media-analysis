"""Apify actor runner."""

from __future__ import annotations

import urllib.parse
from typing import Any

import httpx

from app.config import settings


def _base_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.apify_token}"}


def run_actor_sync(
    actor_id: str,
    input_data: dict[str, Any],
    timeout_seconds: int = 120,
) -> list[dict[str, Any]]:
    """Run an Apify actor synchronously and return dataset items."""
    encoded = urllib.parse.quote(actor_id, safe="")
    url = (
        f"https://api.apify.com/v2/acts/{encoded}/run-sync-get-dataset-items"
        f"?timeout={timeout_seconds}&format=json&clean=true"
    )

    with httpx.Client(timeout=timeout_seconds + 30) as client:
        response = client.post(
            url,
            headers={
                **_base_headers(),
                "Content-Type": "application/json",
            },
            json=input_data,
        )
        response.raise_for_status()
        data = response.json()

    if not isinstance(data, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            cleaned.append(item)
    return cleaned


def scrape_instagram_profiles(usernames: list[str], timeout: int = 150) -> list[dict[str, Any]]:
    return run_actor_sync(
        settings.apify_actor_id,
        {"usernames": usernames, "includeAboutSection": False},
        timeout_seconds=timeout,
    )


def scrape_instagram_post(post_url: str, timeout: int = 240) -> dict[str, Any] | None:
    items = run_actor_sync(
        "apify/instagram-scraper",
        {
            "directUrls": [post_url],
            "resultsType": "details",
            "resultsLimit": 1,
            "addParentData": False,
        },
        timeout_seconds=timeout,
    )
    return items[0] if items else None
