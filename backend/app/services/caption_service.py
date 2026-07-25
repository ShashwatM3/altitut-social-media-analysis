"""AI caption generation for Auto-Post."""

from __future__ import annotations

import re
from typing import Any

from app.models import CaptionRequest, CaptionResponse, PlatformCaption, Provider, Tone
from app.services.openai_client import complete_json
from app.services.pack_service import datetime_now
from app.shared.altitut_context import ALTITUT_CHAT_CONTEXT

_PLATFORM_RULES = """Per-platform voice rules:
- LinkedIn — professional, first-person, insight-led. Hook in line one. Line breaks between short paragraphs. Max 3,000 characters. At most 3 hashtags, at the end. No emoji spam.
- Facebook — warm and conversational, community-oriented. Shorter than LinkedIn. Light emoji.
- Instagram — punchy, hook in the first 125 characters (the pre-"more" cut). Max 2,200 characters. Hashtags go in firstComment, never in the caption.

Hard rule: return ONLY the JSON object matching the schema. No markdown, no explanation, no code fences."""

_JSON_SCHEMA = """{
  "captions": {
    "linkedin": { "caption": "string", "firstComment": "string", "hashtags": ["string"] },
    "facebook": { "caption": "string", "firstComment": "string", "hashtags": ["string"] },
    "instagram": { "caption": "string", "firstComment": "string", "hashtags": ["string"] }
  }
}
For platforms that are not requested, still include the key with empty strings and an empty hashtags array."""


def _clean_hashtags(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [
        f"#{tag}" if not tag.startswith("#") else tag
        for tag in (str(t).strip() for t in raw if t is not None)
        if tag
    ]


def _build_prompt(req: CaptionRequest) -> str:
    mode_instruction = {
        "refine": "Refine the existing copy to make it sharper and better aligned with the brief.",
        "shorten": "Shorten the existing copy while keeping the hook and value.",
        "generate": "Write fresh captions for the requested platforms based on the brief.",
    }[req.mode]

    existing = (
        "Existing copy to work from:\n"
        + "\n".join(f"- {p}: {text}" for p, text in (req.existingCopy or {}).items() if text.strip())
        if req.existingCopy
        else ""
    )

    ground_truth = (
        f"Content-pack ground truth — use the caption templates, hashtags, CTA, and tone below as source of truth, but still adapt per platform (do not copy the templates verbatim when the platform voice demands it):\n---\n{req.packContext}\n---"
        if req.packContext
        else ""
    )

    parts = [
        f"Media kind: {req.mediaKind}",
        f"Brief: {req.brief}",
        f"Tone: {req.tone}" if req.tone else "",
        mode_instruction,
        existing,
        ground_truth,
        f"Requested platforms: {', '.join(req.platforms)}",
        f"Respond with this exact JSON shape:\n{_JSON_SCHEMA}",
    ]
    return "\n\n".join(p for p in parts if p)


def _validate_response(parsed: Any, requested: list[Provider]) -> CaptionResponse:
    captions = {p: PlatformCaption() for p in ("linkedin", "facebook", "instagram")}
    wrapper = parsed.get("captions") if isinstance(parsed, dict) else None
    if not isinstance(wrapper, dict):
        return CaptionResponse(captions=captions)

    for platform in requested:
        raw = wrapper.get(platform)
        if not isinstance(raw, dict):
            continue
        caption = str(raw.get("caption", "")).strip()
        first_comment = str(raw.get("firstComment", "")).strip()
        hashtags = _clean_hashtags(raw.get("hashtags"))

        if platform == "instagram":
            hashtag_pattern = re.compile(r"#\w+")
            extracted = hashtag_pattern.findall(caption)
            clean_caption = hashtag_pattern.sub("", caption).strip()
            all_hashtags = " ".join(list(dict.fromkeys([*hashtags, *extracted])))
            captions["instagram"] = PlatformCaption(
                caption=clean_caption[:2200],
                firstComment=first_comment or all_hashtags,
                hashtags=_clean_hashtags(all_hashtags.split(" ")),
            )
        elif platform == "linkedin":
            all_hashtags = hashtags[:3]
            joined = " ".join(all_hashtags)
            final = caption
            if all_hashtags and joined.lower() not in final.lower():
                final = f"{final.rstrip()}\n\n{joined}".strip()
            captions["linkedin"] = PlatformCaption(
                caption=final[:3000],
                firstComment=first_comment,
                hashtags=all_hashtags,
            )
        else:
            captions["facebook"] = PlatformCaption(
                caption=caption[:63206],
                firstComment=first_comment,
                hashtags=hashtags,
            )

    return CaptionResponse(captions=captions)


def generate_captions(req: CaptionRequest) -> CaptionResponse:
    requested = req.platforms if req.platforms else ["linkedin"]
    parsed = complete_json(
        system=f"{ALTITUT_CHAT_CONTEXT}\n\n{_PLATFORM_RULES}",
        user=_build_prompt(req),
        validate=lambda p: _validate_response(p, requested),
    )
    return parsed
