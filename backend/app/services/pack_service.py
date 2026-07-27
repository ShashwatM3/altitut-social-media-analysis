"""Pack CRUD, normalization, and pack-to-post helpers."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import TypeAdapter

from app.firebase_client import db
from app.models import (
    AnalysisPack,
    ContentBlock,
    PackEntry,
    PackEpisode,
    PackLinks,
    PackSection,
    Placement,
    Provider,
    StoredPack,
)
from app.services.openai_client import slugify

_CONTENT_BLOCK_ADAPTER = TypeAdapter(ContentBlock)

SECTION_ORDER = [
    "understanding-the-reel",
    "identity",
    "product",
    "social",
    "content",
    "top-performers",
    "paid",
    "audience",
    "synthesis",
    "overview",
    "strategy",
    "series",
    "recipe",
    "execution",
]


def _section_sort_key(section: PackSection) -> int:
    try:
        return SECTION_ORDER.index(section.id)
    except ValueError:
        return 999


def normalize_block(raw: Any) -> ContentBlock | None:
    """Coerce an arbitrary LLM block into a typed ContentBlock."""
    if not isinstance(raw, dict):
        return None
    block_type = str(raw.get("type", "paragraph")).lower()
    if block_type == "paragraph":
        text = raw.get("text", "")
        if not isinstance(text, str):
            return None
        return _CONTENT_BLOCK_ADAPTER.validate_python({"type": "paragraph", "text": text})
    if block_type == "bullets":
        items = raw.get("items", [])
        if isinstance(items, str):
            items = [items]
        if not isinstance(items, list):
            return None
        cleaned = [str(i) for i in items if i is not None]
        if not cleaned:
            return None
        return _CONTENT_BLOCK_ADAPTER.validate_python({"type": "bullets", "items": cleaned})
    if block_type == "labeled":
        label = raw.get("label", "")
        items = raw.get("items", [])
        if isinstance(items, str):
            items = [items]
        if not isinstance(items, list):
            return None
        cleaned = [str(i) for i in items if i is not None]
        return _CONTENT_BLOCK_ADAPTER.validate_python(
            {"type": "labeled", "label": str(label), "items": cleaned}
        )
    return None


def normalize_entry(raw: Any) -> PackEntry | None:
    if not isinstance(raw, dict):
        return None
    label = raw.get("label")
    if not isinstance(label, str) or not label.strip():
        return None

    blocks: list[ContentBlock] = []
    raw_blocks = raw.get("blocks", [])
    if raw_blocks is None:
        raw_blocks = []
    if isinstance(raw_blocks, dict):
        raw_blocks = [raw_blocks]
    if isinstance(raw_blocks, list):
        for item in raw_blocks:
            block = normalize_block(item)
            if block:
                blocks.append(block)

    # Legacy single-string values.
    value = raw.get("value")
    if isinstance(value, str) and value.strip() and not blocks:
        blocks = [_CONTENT_BLOCK_ADAPTER.validate_python({"type": "paragraph", "text": value})]

    if not blocks:
        return None
    return PackEntry.model_construct(label=label, blocks=blocks)


def normalize_section(raw: Any) -> PackSection | None:
    if not isinstance(raw, dict):
        return None
    section_id = raw.get("id")
    title = raw.get("title")
    if not isinstance(section_id, str) or not isinstance(title, str):
        return None

    entries: list[PackEntry] = []
    episodes: list[PackEpisode] = []

    raw_entries = raw.get("entries", [])
    if isinstance(raw_entries, list):
        for item in raw_entries:
            entry = normalize_entry(item)
            if entry:
                entries.append(entry)

    raw_episodes = raw.get("episodes", [])
    if isinstance(raw_episodes, list):
        for item in raw_episodes:
            if not isinstance(item, dict):
                continue
            ep_title = item.get("title")
            ep_entries = item.get("entries", [])
            if not isinstance(ep_title, str) or not isinstance(ep_entries, list):
                continue
            cleaned_entries = [normalize_entry(e) for e in ep_entries]
            cleaned_entries = [e for e in cleaned_entries if e]
            if cleaned_entries:
                episodes.append(
                    PackEpisode.model_construct(title=ep_title, entries=cleaned_entries)
                )

    if not entries and not episodes:
        return None
    return PackSection.model_construct(
        id=section_id,
        title=title,
        entries=entries or None,
        episodes=episodes or None,
    )


def normalize_links(raw: Any) -> PackLinks | None:
    if not isinstance(raw, dict):
        return None
    cleaned: dict[str, str] = {}
    for key in ("website", "instagram", "linkedin", "twitter"):
        value = raw.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            cleaned[key] = value
    if not cleaned:
        return None
    return PackLinks.model_construct(**cleaned)


def pack_entry_text(entry: PackEntry) -> str:
    parts: list[str] = []
    for block in entry.blocks or []:
        if block.type == "paragraph":
            parts.append(block.text)
        elif block.type == "bullets":
            parts.extend(f"- {item}" for item in block.items)
        elif block.type == "labeled":
            parts.append(f"{block.label}:")
            parts.extend(f"- {item}" for item in block.items)
    return "\n".join(parts)


def _pack_all_text(pack: AnalysisPack) -> str:
    lines: list[str] = []
    lines.append(f"Pack name: {pack.name}")
    lines.append(f"Pack tag: {pack.tag}")
    lines.append(f"Pack meta: {pack.meta}")
    if pack.tldr:
        lines.append(f"TL;DR:\n{pack.tldr}")
    for section in pack.sections:
        lines.append(f"# {section.title}")
        for entry in section.entries or []:
            lines.append(f"## {entry.label}")
            lines.append(pack_entry_text(entry))
        for episode in section.episodes or []:
            lines.append(f"## {episode.title}")
            for entry in episode.entries:
                lines.append(f"### {entry.label}")
                lines.append(pack_entry_text(entry))
    return "\n\n".join(lines)


def pack_to_ground_truth(pack: AnalysisPack, max_length: int = 4000) -> str:
    text = _pack_all_text(pack)
    if len(text) > max_length:
        text = text[:max_length]
    return text


def pack_to_brief(pack: AnalysisPack, max_length: int = 500) -> str:
    # Prefer first sentence of TL;DR.
    if pack.tldr:
        first = pack.tldr.split("\n")[0].strip()
        if first:
            return first[:max_length]

    # Fall back to episode title/angle.
    for section in pack.sections:
        for episode in section.episodes or []:
            for entry in episode.entries:
                if "title" in entry.label.lower() or "angle" in entry.label.lower():
                    text = pack_entry_text(entry).strip()
                    if text:
                        return text[:max_length]

    # Last resort: use pack name + meta.
    text = f"{pack.name} · {pack.meta}"
    return text[:max_length]


def _pack_text_lower(pack: AnalysisPack) -> str:
    return _pack_all_text(pack).lower()


def derive_media_kind_from_pack(pack: AnalysisPack) -> Literal["video", "image"]:
    text = _pack_text_lower(pack)
    if any(k in text for k in ("reel", "video", "talking-head", "talking head")):
        return "video"
    if any(k in text for k in ("carousel", "photo", "image")):
        return "image"
    return "video"


def derive_placement_from_pack(pack: AnalysisPack) -> Placement:
    text = _pack_text_lower(pack)
    if "reel" in text:
        return "reel"
    if "story" in text:
        return "story"
    return "feed"


def derive_platforms_from_pack(pack: AnalysisPack) -> list[Provider]:
    text = _pack_text_lower(pack)
    platforms: list[Provider] = []
    if any(k in text for k in ("instagram", "ig", "reel", "tiktok", "youtube shorts")):
        platforms.append("instagram")
    if "facebook" in text:
        platforms.append("facebook")
    if "linkedin" in text:
        platforms.append("linkedin")
    if not platforms:
        platforms.append("instagram")
    return platforms


def _sanitize_for_firestore(obj: Any) -> Any:
    """Strip None and empty collections via JSON round-trip."""
    return json.loads(json.dumps(obj, default=str))


def save_pack(
    collection_name: str,
    pack: AnalysisPack,
    source: str,
    pack_id: str | None = None,
) -> StoredPack:
    if pack_id is None:
        pack_id = slugify(pack.name)

    stored = StoredPack.model_construct(
        **pack.model_dump(mode="json", exclude_none=True),
        id=pack_id,
        source=source,  # type: ignore[arg-type]
        createdAt=datetime_now(),
    )
    data = _sanitize_for_firestore(stored.model_dump(mode="json"))
    db.collection(collection_name).document(pack_id).set(data)
    return stored


def fetch_packs(collection_name: str) -> list[StoredPack]:
    docs = (
        db.collection(collection_name)
        .order_by("createdAt")
        .stream()
    )
    packs: list[StoredPack] = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            data["id"] = doc.id
            packs.append(StoredPack.model_validate(data))
    return packs


def delete_pack(collection_name: str, pack_id: str) -> None:
    db.collection(collection_name).document(pack_id).delete()


def datetime_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def sort_sections(sections: list[PackSection]) -> list[PackSection]:
    return sorted(sections, key=_section_sort_key)
