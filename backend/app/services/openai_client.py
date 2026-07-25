"""OpenAI client wrapper for JSON completions and embeddings."""

from __future__ import annotations

import json
import re
from typing import Any, Callable, TypeVar

import openai

from app.config import settings

T = TypeVar("T")

_client: openai.OpenAI | None = None


def get_client() -> openai.OpenAI:
    global _client  # noqa: PLW0603
    if _client is None:
        _client = openai.OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    return _client


def _extract_json(text: str) -> str:
    # Strip markdown code fences if present.
    text = text.strip()
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```")
        text = text.removesuffix("```").strip()
    return text


def complete_json(
    system: str,
    user: str,
    *,
    images: list[str] | None = None,
    max_output_tokens: int = 4096,
    validate: Callable[[Any], T] | None = None,
    model: str | None = None,
) -> T:
    """Single-turn chat completion that returns parsed JSON.

    Mirrors `lib/openai.ts::completeJson` including the one-repair attempt on
    parse failure.
    """
    client = get_client()
    chosen = model or settings.openai_model

    content: list[dict[str, Any]] = [{"type": "text", "text": user}]
    if images:
        for image_url in images[:4]:
            content.append(
                {"type": "image_url", "image_url": {"url": image_url, "detail": "low"}}
            )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": content},
    ]

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=chosen,
                messages=messages,  # type: ignore[arg-type]
                response_format={"type": "json_object"},
                max_tokens=max_output_tokens,
            )
            raw = response.choices[0].message.content or ""
            parsed = json.loads(_extract_json(raw))
            if validate:
                return validate(parsed)
            return parsed  # type: ignore[return-value]
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            last_error = exc
            repair_instruction = (
                "\n\nYour previous response was not valid JSON. Return ONLY a valid JSON object."
            )
            if attempt == 1:
                continue
            # Append repair instruction on first failure and retry.
            content[0]["text"] = user + repair_instruction
            messages = [
                {"role": "system", "content": system},
                {"role": "user", "content": content},
            ]

    raise ValueError(
        f"OpenAI response was not valid JSON after 2 attempts: {last_error}"
    ) from last_error


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embedding with `text-embedding-3-small` at 512 dimensions."""
    client = get_client()
    if not texts:
        return []

    results: list[list[float]] = []
    batch_size = 96
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.embeddings.create(
            input=batch,
            model="text-embedding-3-small",
            dimensions=settings.embedding_dimensions,
        )
        for item in response.data:
            results.append([round(x, 6) for x in item.embedding])
    return results


def slugify(value: str, max_length: int = 80) -> str:
    """Simple slugify matching the TypeScript `lib/packs.ts::slugify`."""
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value[:max_length]
