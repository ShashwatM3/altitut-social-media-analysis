"""Exa AI search/contents client."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class ExaResult:
    def __init__(self, raw: dict[str, Any]):
        self.raw = raw

    @property
    def title(self) -> str | None:
        return self.raw.get("title")

    @property
    def url(self) -> str:
        return self.raw.get("url", "")

    @property
    def text(self) -> str | None:
        return self.raw.get("text")

    @property
    def highlights(self) -> list[str] | None:
        return self.raw.get("highlights")

    @property
    def published_date(self) -> str | None:
        return self.raw.get("publishedDate")

    def to_dict(self) -> dict[str, Any]:
        return self.raw


def _headers() -> dict[str, str]:
    return {"x-api-key": settings.exa_api_key, "Content-Type": "application/json"}


def search(
    query: str,
    *,
    num_results: int = 10,
    category: str | None = None,
    include_text: bool = False,
    max_characters: int = 2500,
    include_domains: list[str] | None = None,
) -> list[ExaResult]:
    """Exa `/search` endpoint."""
    body: dict[str, Any] = {
        "query": query,
        "type": "auto",
        "numResults": num_results,
        "useAutoprompt": True,
    }
    if category:
        body["category"] = category
    if include_text:
        body["contents"] = {"text": {"maxCharacters": max_characters}}
    if include_domains:
        body["includeDomains"] = include_domains

    with httpx.Client(timeout=60) as client:
        response = client.post(
            f"{settings.exa_base_url}/search",
            headers=_headers(),
            json=body,
        )
        response.raise_for_status()
        data = response.json()

    results = data.get("results", []) if isinstance(data, dict) else data
    if not isinstance(results, list):
        return []

    return [ExaResult(item) for item in results if isinstance(item, dict) and item.get("url")]


def contents(urls: list[str], max_characters: int = 8000) -> list[ExaResult]:
    """Exa `/contents` endpoint with fallback livecrawl."""
    if not urls:
        return []

    body = {
        "urls": urls,
        "text": True,
        "textOptions": {"maxCharacters": max_characters},
        "livecrawl": "fallback",
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(
            f"{settings.exa_base_url}/contents",
            headers=_headers(),
            json=body,
        )
        response.raise_for_status()
        data = response.json()

    results = data.get("results", []) if isinstance(data, dict) else data
    if not isinstance(results, list):
        return []

    return [ExaResult(item) for item in results if isinstance(item, dict) and item.get("url")]
