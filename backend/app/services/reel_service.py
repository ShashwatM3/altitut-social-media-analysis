"""Reel → content-pack pipeline."""

from __future__ import annotations

import base64
import io
import re
from typing import Any, Callable

import httpx

from app.models import AnalysisPack, PackSection, ReelAnalysis, ReelData, ReelMusicInfo
from app.services.apify_client import scrape_instagram_post
from app.services.openai_client import complete_json, get_client
from app.services.pack_service import normalize_section
from app.shared.altitut_context import DEFAULT_ALTITUT_DESCRIPTION

_CONTENT_PACK_RULES = """Each section is {"id", "title", "entries": [{"label", "blocks"}]} — the episode-plan section uses "episodes": [{"title", "entries"}] instead of entries.
Each block is ONE of:
  {"type": "paragraph", "text": "..."}
  {"type": "bullets", "items": ["...", "..."]} — 3-7 substantive items
  {"type": "labeled", "label": "Group name", "items": ["...", "..."]}
Entry pattern: an opening paragraph block, then one or two bullets/labeled blocks.
Every bullet must be specific and executable by a social media team member — camera directions, spoken lines, timings — never generic advice."""

_GROUNDING_RULES = """GROUNDING RULES (non-negotiable):
- The "OBSERVED FACTS" block below is the ONLY source of truth about the reference reel's format, visuals, audio, caption, and hashtags. Sections 5.2 Visual Style and 5.3 Audio must MIRROR the reel's observed style (adapted to Altitut's subject matter) — if the reel is a raw talking head with photo cut-ins and caption overlays, the recipe is a raw talking head with photo cut-ins and caption overlays, NOT animations, stock footage, or background music that was never there.
- Never introduce music, graphics, effects, or caption/hashtag tactics that contradict the observed facts. If you deliberately deviate from the reel (e.g. adding hashtags the creator didn't use), flag it explicitly as "Deviation from the reference reel:" with a one-line justification.
- Altitut's pixel-art game aesthetic may ONLY appear as actual product footage being shown (screen recordings of the product), never as the reel's overall art style.
- Where a fact is marked UNKNOWN, write "match the reference reel" rather than inventing a choice."""


def _as_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and value == value:  # exclude NaN
        return float(value)
    return None


def extract_instagram_url(text: str) -> str | None:
    match = re.search(r"https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/[A-Za-z0-9_-]+/?", text)
    return match.group(0) if match else None


def fetch_reel_data(reel_url: str) -> ReelData:
    item = scrape_instagram_post(reel_url)
    if not item:
        raise ValueError("Apify returned no data for that link — the reel may be private, deleted, or region-locked.")
    if isinstance(item.get("error"), str) and item["error"]:
        raise ValueError(f"Apify could not scrape the reel: {item['error']}")

    raw_music = item.get("musicInfo")
    music_info: ReelMusicInfo | None = None
    if isinstance(raw_music, dict):
        music_info = ReelMusicInfo(
            artist=str(raw_music.get("artist_name", "")),
            song=str(raw_music.get("song_name", "")),
            usesOriginalAudio=raw_music.get("uses_original_audio") if isinstance(raw_music.get("uses_original_audio"), bool) else None,
        )

    return ReelData(
        url=reel_url,
        caption=str(item.get("caption", "")),
        hashtags=[str(h) for h in item.get("hashtags", [])] if isinstance(item.get("hashtags"), list) else [],
        ownerUsername=str(item.get("ownerUsername", "")),
        ownerFullName=str(item.get("ownerFullName", "")),
        likes=_as_number(item.get("likesCount")),
        comments=_as_number(item.get("commentsCount")),
        videoViews=_as_number(item.get("videoPlayCount")) or _as_number(item.get("videoViewCount")),
        videoDurationSeconds=_as_number(item.get("videoDuration")),
        timestamp=str(item.get("timestamp")) if isinstance(item.get("timestamp"), str) else None,
        videoUrl=str(item.get("videoUrl")) if isinstance(item.get("videoUrl"), str) else None,
        displayUrl=str(item.get("displayUrl")) if isinstance(item.get("displayUrl"), str) else None,
        images=[str(u) for u in item.get("images", []) if isinstance(u, str)] if isinstance(item.get("images"), list) else [],
        musicInfo=music_info,
        productType=str(item.get("productType", "")),
    )


def _reel_digest(reel: ReelData, transcript: str | None) -> str:
    audio_line = (
        f"Audio metadata: {'ORIGINAL audio (creator\'s own voice/sound)' if reel.musicInfo and reel.musicInfo.usesOriginalAudio else 'licensed track'}{(' — \"' + reel.musicInfo.song + '\" by ' + reel.musicInfo.artist) if reel.musicInfo and reel.musicInfo.song else ''}"
        if reel.musicInfo
        else "Audio metadata: not returned by scraper"
    )
    return "\n\n".join(
        [
            f"Reel URL: {reel.url}",
            f"Creator: @{reel.ownerUsername}{(f' ({reel.ownerFullName})') if reel.ownerFullName else ''}",
            f"Stats: likes={reel.likes or '?'} comments={reel.comments or '?'} views={reel.videoViews or '?'} duration={reel.videoDurationSeconds or '?'}s posted={reel.timestamp or '?'}",
            audio_line,
            f"Caption (VERBATIM — this is exactly what the creator posted):\n{reel.caption or '(no caption)'}",
            f"Hashtags: {' '.join(reel.hashtags) or '(none — the creator used no hashtags)'}",
            f"Full spoken transcript (Whisper, VERBATIM):\n{transcript or '(transcript unavailable — rely on caption, images, and stats only, and say so where it matters)'}",
        ]
    )


def transcribe_reel(video_url: str) -> str | None:
    try:
        with httpx.Client(timeout=60) as client:
            response = client.get(video_url)
            if not response.is_success:
                return None
            if len(response.content) > 24 * 1024 * 1024:
                return None
            buffer = io.BytesIO(response.content)
            buffer.name = "reel.mp4"
            transcription = get_client().audio.transcriptions.create(
                model="whisper-1",
                file=buffer,
            )
            return transcription.text.strip() or None
    except Exception:
        return None


def _fetch_image_as_data_url(url: str) -> str | None:
    try:
        with httpx.Client(timeout=20) as client:
            response = client.get(url)
            if not response.is_success:
                return None
            content_type = response.headers.get("content-type", "image/jpeg")
            if not content_type.startswith("image/"):
                return None
            if len(response.content) > 6 * 1024 * 1024:
                return None
            return f"data:{content_type};base64,{base64.b64encode(response.content).decode()}"
    except Exception:
        return None


def analyze_reel(reel: ReelData, transcript: str | None) -> ReelAnalysis:
    candidate_urls = [u for u in [reel.displayUrl, *reel.images] if u][:4]
    frame_urls = [u for u in (_fetch_image_as_data_url(url) for url in candidate_urls) if u]

    parsed = complete_json(
        system=(
            "You are a short-form video analyst. You dissect ONE Instagram reel with forensic accuracy. "
            "You may ONLY state what is directly evidenced by the transcript, caption, stats, audio metadata, and the attached frame images. "
            "Quote the creator's actual words when describing hooks and beats. If something cannot be observed (e.g. background music when metadata is missing), write 'not observable from available data' — NEVER guess or embellish. "
            + _CONTENT_PACK_RULES
        ),
        user=(
            f"=== THE REEL (scraped live; frames attached as images) ===\n{_reel_digest(reel, transcript)}\n\n"
            + f"""Produce JSON {{"section", "observed_facts"}}.

"section": {{"id": "understanding", "title": "1. UNDERSTANDING THE REEL", "entries": [...]}} with EXACTLY these entries:
- "1.1 What Actually Happens" — a beat-by-beat replay of the reel from the transcript (opening line quoted verbatim → middle beats → ending), with approximate second-marks scaled to the real {reel.videoDurationSeconds or '?'}s duration.
- "1.2 The Hook" — the verbatim opening line(s) in quotes + a breakdown of the psychological devices it uses (pattern interrupt, negative qualifier, curiosity gap, etc. — only ones actually present).
- "1.3 Structure & Strategy" — the narrative arc, retention devices, pacing, how it earns the next second of watch time, and what the creator is strategically doing (positioning, vulnerability, authority…).
- "1.4 Production Style (as observed)" — labeled blocks "On screen" (what the frames + transcript evidence: talking head? photos? text overlays/captions?), "Audio" (from audio metadata + transcript: original voice? track?), "Caption & hashtags" (describe the VERBATIM caption strategy — if it's minimal, say so and explain why that works or doesn't).
- "1.5 Why It Performed" — tie the real numbers ({reel.videoViews or '?'} views, {reel.likes or '?'} likes, {reel.comments or '?'} comments) to the specific craft choices above.

"observed_facts": a dense 10-15 line plain-text fact sheet of ONLY observed production facts, one per line, for downstream writers. Cover: format (talking head / voiceover / b-roll), visual elements seen in frames, text overlay style, audio reality, caption reality, hashtag reality, hook quote, duration, pacing, tone. Prefix unobservable items with "UNKNOWN:"."""
        ),
        images=frame_urls,
        max_output_tokens=6000,
        validate=lambda value: _validate_analysis(value),
    )
    return ReelAnalysis(
        section=parsed["section"],
        observedFacts=parsed["observed_facts"],
    )


def _validate_analysis(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("invalid analysis response")
    section = normalize_section(value.get("section"))
    if not section or not section.entries or len(section.entries) < 4:
        raise ValueError("understanding section must have the 5 requested entries")
    observed_facts = str(value.get("observed_facts", "")).strip()
    if not observed_facts:
        raise ValueError("missing observed_facts")
    return {"section": section, "observed_facts": observed_facts}


def synthesize_content_pack(
    reel: ReelData,
    transcript: str | None,
    analysis: ReelAnalysis,
    pack_number: int,
) -> AnalysisPack:
    shared_context = (
        f"=== ALTITUT (THE PRODUCT THIS SERIES MUST PROMOTE) ===\n{DEFAULT_ALTITUT_DESCRIPTION}\n\n"
        f"=== THE REFERENCE REEL (scraped live) ===\n{_reel_digest(reel, transcript)}\n\n"
        f"=== OBSERVED FACTS (from the frame-level analysis pass) ===\n{analysis.observedFacts}"
    )
    system = (
        "You are Altitut's head of social content. You translate ONE analyzed viral reel into a repeatable content-series pack that Altitut's social team can execute. The pack answers: how does this reel's craft transfer to Altitut? "
        + _GROUNDING_RULES
        + "\n"
        + _CONTENT_PACK_RULES
    )

    plan = complete_json(
        system=system,
        user=(
            f"{shared_context}\n\n"
            + f"""Produce JSON {{"name", "meta", "sections"}} where:
"name": a punchy 2-4 word series name for Altitut's version of this format (NOT the creator's name).
"meta": format line like "45–90s Reel · IG / TikTok / Shorts" — pick a clean rounded range containing the reel's real ~{int(reel.videoDurationSeconds) if reel.videoDurationSeconds else '?'}s duration (e.g. "20–30s Reel · IG / TikTok / Shorts").
"sections" are EXACTLY these four (numbering continues after "1. UNDERSTANDING THE REEL", which is already written):
1) id "overview", title "2. OVERVIEW" — entries "2.1 Series Name + Premise" (include a labeled block "One-line hook concept" and "What makes this a franchise (not a one-off)"), "2.2 Format & Platform" (labeled blocks: Format / Length / Platforms / Visual mode — all mirroring the OBSERVED FACTS), "2.3 Origin" (what the reference reel proves works — cite its real craft choices and numbers — and why the format fits Altitut).
2) id "strategy", title "3. STRATEGY" — entries "3.1 What It Promotes" (which Altitut features this series demos), "3.2 Goal" (labeled: Primary goal / Secondary goal), "3.3 Who It's For".
3) id "recipe", title "5. THE RECIPE → HOW TO MAKE" — entries "5.1 Structure" (hook→body→CTA skeleton with second-marks mirroring the reference reel's actual pacing from the observed facts), "5.2 Visual Style" (MIRROR the observed on-screen reality), "5.3 Audio" (MIRROR the observed audio reality), "5.4 Caption + Hashtags" (start from the reel's VERBATIM caption strategy; any deviation must be flagged as such).
4) id "execution", title "6. EXECUTION" — entries "6.1 Cadence", "6.2 Roles & Effort", "6.3 What Good Looks Like" (light leading metrics benchmarked against the reel's real numbers)."""
        ),
        max_output_tokens=7000,
        validate=lambda value: _validate_plan(value),
    )

    plan_section_data = plan["sections"]
    plan_sections = [s for s in (normalize_section(s) for s in plan_section_data) if s is not None]
    plan_name = str(plan["name"]).strip()

    series = complete_json(
        system=system,
        user=(
            f"{shared_context}\n\n"
            + f'The series is called "{plan_name}". Its overview/strategy (already written):\n{str([s.model_dump(mode="json", exclude_none=True) for s in plan_sections[:2]])[:3500]}\n\n'
            + """Produce JSON for the episode plan section ONLY: {"id": "series", "title": "4. THE SERIES → WHAT TO MAKE", "episodes": [...]} with EXACTLY 3 episodes.
Each episode: {"title": "Episode N — <specific angle>", "entries": [...]} with entries labeled "4.N.1 Title / Angle", "4.N.2 Hook" (spoken first line modeled on the reference reel's actual hook device + visual hook direction consistent with the observed format), "4.N.3 What It Shows" (beat-by-beat with rough second-marks matching the reel's observed pacing), "4.N.4 CTA" (a CTA consistent with the reel's low-pressure style; if using a comment-keyword funnel, flag it as a deviation — one DIFFERENT single-word keyword per episode).
Episode 1 must be Altitut's closest adaptation of the reference reel itself (same emotional register, same structure, Altitut's story); episodes 2-3 extend the same franchise to other Altitut angles."""
        ),
        max_output_tokens=6000,
        validate=lambda value: _validate_series(value),
    )

    find = lambda sid: next(s for s in plan_sections if s.id == sid)
    ordered: list[PackSection] = [
        analysis.section,
        find("overview"),
        find("strategy"),
        series,
        find("recipe"),
        find("execution"),
    ]

    return AnalysisPack(
        name=plan_name,
        tag=f"Pack {str(pack_number).zfill(2)}",
        meta=plan["meta"],
        referenceReels=[reel.url],
        sections=ordered,
    )


def _validate_plan(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("invalid plan response")
    sections_raw = value.get("sections")
    if not isinstance(sections_raw, list):
        raise ValueError("missing sections")
    sections = [s for s in (normalize_section(s) for s in sections_raw) if s is not None]
    ids = [s.id for s in sections]
    for required in ("overview", "strategy", "recipe", "execution"):
        if required not in ids:
            raise ValueError(f'missing section id "{required}" (got: {", ".join(ids)})')
    name = str(value.get("name", "")).strip()
    if not name:
        raise ValueError("missing pack name")
    meta = str(value.get("meta", "")).strip() or "45–90s Reel · IG / TikTok / Shorts"
    return {"name": name, "meta": meta, "sections": sections}


def _validate_series(value: Any) -> PackSection:
    section = normalize_section(value)
    if not section or not section.episodes or len(section.episodes) < 3:
        raise ValueError("expected a section with 3 episodes")
    return section


async def build_content_pack_from_reel(
    reel_url: str,
    pack_number: int,
    on_progress: Callable[[str], Any] | None = None,
) -> dict[str, Any]:
    reel = fetch_reel_data(reel_url)
    if on_progress:
        on_progress(f"Scraped the reel by @{reel.ownerUsername or 'unknown'} — {reel.videoViews or '?'} views, {reel.likes or '?'} likes. Transcribing…")
    transcript = transcribe_reel(reel.videoUrl) if reel.videoUrl else None
    if on_progress:
        on_progress(
            "Transcript captured. Analyzing the reel frame-by-frame…"
            if transcript
            else "No transcript available (video inaccessible) — analyzing from caption, frames + stats…"
        )
    analysis = analyze_reel(reel, transcript)
    if on_progress:
        on_progress("Reel understood (hook, structure, production style). Building Altitut's content pack…")
    pack = synthesize_content_pack(reel, transcript, analysis, pack_number)
    return {"pack": pack, "reel": reel, "transcript": transcript}
