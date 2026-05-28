from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException

from backend.connectors.apify import ApifyConnector, ApifyExecutionError, ApifySetupRequiredError
from backend.db.competitors import approve_competitor, list_competitors, record_run, save_competitor
from backend.db.posts import approve_post, list_posts, save_post
from backend.settings import load_runtime_config

runtime = load_runtime_config()
app = FastAPI(title=runtime.app.name, version=runtime.app.version)


async def root() -> dict[str, str]:
    return {"message": "ALTITUT Social Media Analysis API", "status": "ok"}


async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": runtime.app.name,
        "version": runtime.app.version,
    }


async def apify_status() -> dict[str, Any]:
    return ApifyConnector().status().to_dict()


async def competitor_scout(request: dict[str, Any]) -> dict[str, Any]:
    scout_input = _validate_scout_request(request)
    connector = ApifyConnector()
    integration = connector.status()

    if not integration.ready:
        run = record_run(
            run_type="competitor_scout",
            provider=integration.provider,
            status="setup_required",
            input_payload=scout_input,
            output_payload=integration.to_dict(),
            error_message="Apify setup required before competitor scouting can run.",
        )
        return {
            "status": "setup_required",
            "integration": integration.to_dict(),
            "run": run,
        }

    try:
        execution = connector.execute_competitor_scout(scout_input)
    except ApifySetupRequiredError as exc:
        setup_response = connector.setup_required().to_dict()
        run = record_run(
            run_type="competitor_scout",
            provider=integration.provider,
            status="setup_required",
            input_payload=scout_input,
            output_payload=setup_response,
            error_message=str(exc),
        )
        return {
            "status": "setup_required",
            "integration": setup_response,
            "run": run,
        }
    except ApifyExecutionError as exc:
        run = record_run(
            run_type="competitor_scout",
            provider=integration.provider,
            status="failed",
            input_payload=scout_input,
            output_payload={"error": str(exc)},
            error_message=str(exc),
        )
        return {
            "status": "failed",
            "integration": integration.to_dict(),
            "run": run,
            "error": str(exc),
        }

    saved_candidates = [
        save_competitor(candidate, approved=False, source_run_id=execution.run_id)
        for candidate in execution.candidates
    ]
    run = record_run(
        run_type="competitor_scout",
        provider=integration.provider,
        status="completed",
        input_payload=scout_input,
        output_payload={
            "apify_run": execution.raw_run,
            "dataset_id": execution.dataset_id,
            "raw_item_count": len(execution.raw_items),
            "candidate_count": len(saved_candidates),
            "candidate_ids": [candidate["id"] for candidate in saved_candidates],
        },
        run_id=execution.run_id,
    )
    return {
        "status": "completed",
        "integration": integration.to_dict(),
        "run": run,
        "candidate_count": len(saved_candidates),
        "candidates": saved_candidates,
    }


async def create_competitor(candidate: dict[str, Any]) -> dict[str, Any]:
    payload = _validate_competitor_payload(candidate)
    return save_competitor(payload, approved=False, source_run_id=payload.get("source_run_id"))


async def approve_competitor_route(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return approve_competitor(competitor_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def get_competitors(approved: bool | None = None) -> list[dict[str, Any]]:
    return list_competitors(approved=approved)


async def get_posts(
    approved: bool | None = None,
    competitor_id: str | None = None,
) -> list[dict[str, Any]]:
    return list_posts(approved=approved, competitor_id=competitor_id)


async def approve_post_route(post_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return approve_post(post_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def posts_analysis(request: dict[str, Any]) -> dict[str, Any]:
    analysis_input, missing_requirements, next_steps = _resolve_posts_analysis_request(request)
    connector = ApifyConnector()
    integration = connector.status()

    if missing_requirements:
        setup_response = {
            "provider": integration.provider,
            "ready": False,
            "status": "setup_required",
            "missing_requirements": missing_requirements,
            "next_steps": next_steps,
            "docs_url": integration.docs_url,
            "details": {
                **integration.details,
                "requested_targets": analysis_input["targets"],
            },
        }
        run = record_run(
            run_type="posts_analysis",
            provider=integration.provider,
            status="setup_required",
            input_payload=analysis_input,
            output_payload=setup_response,
            error_message="Posts analysis requires approved companies with Instagram usernames.",
        )
        return {
            "status": "setup_required",
            "integration": setup_response,
            "run": run,
        }

    if not integration.ready:
        run = record_run(
            run_type="posts_analysis",
            provider=integration.provider,
            status="setup_required",
            input_payload=analysis_input,
            output_payload=integration.to_dict(),
            error_message="Apify setup required before posts analysis can run.",
        )
        return {
            "status": "setup_required",
            "integration": integration.to_dict(),
            "run": run,
        }

    try:
        execution = connector.execute_posts_analysis(analysis_input)
    except ApifySetupRequiredError as exc:
        setup_response = connector.setup_required().to_dict()
        run = record_run(
            run_type="posts_analysis",
            provider=integration.provider,
            status="setup_required",
            input_payload=analysis_input,
            output_payload=setup_response,
            error_message=str(exc),
        )
        return {
            "status": "setup_required",
            "integration": setup_response,
            "run": run,
        }
    except ApifyExecutionError as exc:
        run = record_run(
            run_type="posts_analysis",
            provider=integration.provider,
            status="failed",
            input_payload=analysis_input,
            output_payload={"error": str(exc)},
            error_message=str(exc),
        )
        return {
            "status": "failed",
            "integration": integration.to_dict(),
            "run": run,
            "error": str(exc),
        }

    saved_posts = [
        {
            **save_post(post, approved=False, source_run_id=post["source_run_id"]),
            "competitor_name": post["competitor_name"],
            "analysis": post["analysis"],
        }
        for post in execution.posts
    ]
    run = record_run(
        run_type="posts_analysis",
        provider=integration.provider,
        status="completed",
        input_payload=analysis_input,
        output_payload={
            "apify_run_ids": execution.run_ids,
            "dataset_ids": execution.dataset_ids,
            "raw_item_count": len(execution.raw_items),
            "post_count": len(saved_posts),
            "post_ids": [post["id"] for post in saved_posts],
        },
    )
    return {
        "status": "completed",
        "integration": integration.to_dict(),
        "run": run,
        "post_count": len(saved_posts),
        "posts": saved_posts,
    }


app.add_api_route("/", root, methods=["GET"])
app.add_api_route("/health", health, methods=["GET"])
app.add_api_route("/integrations/apify/status", apify_status, methods=["GET"])
app.add_api_route("/competitor-scout", competitor_scout, methods=["POST"])
app.add_api_route("/competitors", get_competitors, methods=["GET"])
app.add_api_route("/competitors", create_competitor, methods=["POST"])
app.add_api_route("/competitors/{competitor_id}/approve", approve_competitor_route, methods=["POST"])
app.add_api_route("/posts-analyze", posts_analysis, methods=["POST"])
app.add_api_route("/posts", get_posts, methods=["GET"])
app.add_api_route("/posts/{post_id}/approve", approve_post_route, methods=["POST"])


def _resolve_posts_analysis_request(payload: dict[str, Any]) -> tuple[dict[str, Any], list[str], list[str]]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")

    retrieval_mode = _require_text(payload.get("retrieval_mode") or "recent", "retrieval_mode").lower()
    if retrieval_mode not in {"recent", "popular"}:
        raise HTTPException(status_code=422, detail="retrieval_mode must be recent or popular.")

    post_limit_value = payload.get("post_limit", 6)
    try:
        post_limit = max(1, int(post_limit_value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="post_limit must be a positive integer.") from exc

    notes = _coerce_string_list(payload.get("notes"), "notes")
    requested_competitor_ids = _coerce_string_list(payload.get("competitor_ids"), "competitor_ids")
    requested_usernames = _coerce_instagram_usernames(payload.get("usernames"), "usernames")
    if not requested_usernames:
        requested_usernames = _coerce_instagram_usernames(payload.get("profile_urls"), "profile_urls")

    targets: list[dict[str, Any]] = []
    missing_requirements: list[str] = []
    next_steps: list[str] = []
    seen_targets: set[str] = set()

    if requested_competitor_ids:
        approved_competitors = {row["id"]: row for row in list_competitors(approved=True)}
        for competitor_id in requested_competitor_ids:
            competitor = approved_competitors.get(competitor_id)
            if competitor is None:
                missing_requirements.append(f"competitor:{competitor_id}")
                next_steps.append(f"Approve competitor {competitor_id} before analyzing posts.")
                continue
            username = _extract_instagram_username_from_competitor(competitor)
            if not username:
                missing_requirements.append(f"{competitor_id}:instagram_username")
                next_steps.append(
                    f"Add an Instagram profile link to the approved competitor {competitor['name']}."
                )
                continue
            target_key = competitor_id
            if target_key in seen_targets:
                continue
            seen_targets.add(target_key)
            targets.append(
                {
                    "competitor_id": competitor_id,
                    "competitor_name": competitor["name"],
                    "usernames": [username],
                }
            )

    for username in requested_usernames:
        target_key = f"username:{username.lower()}"
        if target_key in seen_targets:
            continue
        seen_targets.add(target_key)
        targets.append(
            {
                "competitor_id": f"company-{username.lower().replace('.', '-')}",
                "competitor_name": username.replace(".", " ").title(),
                "usernames": [username],
            }
        )

    if not targets and not missing_requirements:
        missing_requirements.append("competitor_ids or usernames")
        next_steps.append("Provide approved competitor_ids or direct Instagram usernames/profile_urls.")

    analysis_input = {
        "targets": targets,
        "retrieval_mode": retrieval_mode,
        "post_limit": post_limit,
        "notes": notes,
    }
    return analysis_input, missing_requirements, next_steps


def _extract_instagram_username_from_competitor(candidate: dict[str, Any]) -> str | None:
    social_links = candidate.get("social_links")
    if isinstance(social_links, dict):
        for key in ("instagram", "instagram_url", "instagramUrl", "profile_url", "profileUrl"):
            value = social_links.get(key)
            if isinstance(value, str) and value.strip():
                usernames = _coerce_instagram_usernames([value], key)
                if usernames:
                    return usernames[0]
    return None


def _validate_scout_request(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    raw_usernames = payload.get("usernames")
    raw_profile_urls = payload.get("profile_urls")
    usernames = _coerce_instagram_usernames(raw_usernames, "usernames")
    if not usernames:
        usernames = _coerce_instagram_usernames(raw_profile_urls, "profile_urls")
    if not usernames:
        raise HTTPException(
            status_code=422,
            detail="usernames or profile_urls must contain at least one Instagram profile.",
        )
    altitut_context = _optional_text(payload.get("altitut_context"))
    focus_keywords = _coerce_string_list(payload.get("focus_keywords"), "focus_keywords")
    notes = _coerce_string_list(payload.get("notes"), "notes")
    return {
        "usernames": usernames,
        "altitut_context": altitut_context,
        "focus_keywords": focus_keywords,
        "notes": notes,
    }


def _validate_competitor_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    candidate_id = _require_text(payload.get("id"), "id")
    name = _require_text(payload.get("name"), "name")
    relevance_summary = _require_text(payload.get("relevance_summary"), "relevance_summary")
    traction_summary = _require_text(payload.get("traction_summary"), "traction_summary")
    website_value = payload.get("website")
    website = None
    if isinstance(website_value, str) and website_value.strip():
        website = website_value.strip()
    elif website_value is not None and not isinstance(website_value, str):
        raise HTTPException(status_code=422, detail="website must be a string or null.")
    social_links = _coerce_string_mapping(payload.get("social_links"), "social_links")
    source_run_id = payload.get("source_run_id")
    if source_run_id is not None and not isinstance(source_run_id, str):
        raise HTTPException(status_code=422, detail="source_run_id must be a string or null.")
    return {
        "id": candidate_id,
        "name": name,
        "website": website,
        "social_links": social_links,
        "relevance_summary": relevance_summary,
        "traction_summary": traction_summary,
        "source_run_id": source_run_id,
    }


def _require_text(value: Any, field_name: str, *, min_length: int = 1) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a string.")
    text = value.strip()
    if len(text) < min_length:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be at least {min_length} characters long.",
        )
    return text


def _optional_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _coerce_string_list(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if not isinstance(value, list):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a list of strings.")
    result: list[str] = []
    for entry in value:
        if isinstance(entry, str):
            text = entry.strip()
            if text:
                result.append(text)
        elif entry is not None:
            text = str(entry).strip()
            if text:
                result.append(text)
    return result


def _coerce_string_mapping(value: Any, field_name: str) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise HTTPException(status_code=422, detail=f"{field_name} must be an object.")
    result: dict[str, str] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            continue
        if isinstance(item, str) and item.strip():
            result[key] = item.strip()
        elif item is not None:
            text = str(item).strip()
            if text:
                result[key] = text
    return result


def _coerce_instagram_usernames(value: Any, field_name: str) -> list[str]:
    raw_values = _coerce_string_list(value, field_name)
    usernames: list[str] = []
    seen: set[str] = set()
    for raw in raw_values:
        cleaned = raw.strip()
        if not cleaned:
            continue
        if cleaned.startswith(("http://", "https://")):
            parsed = urlparse(cleaned)
            path_parts = [part for part in parsed.path.split("/") if part]
            cleaned = path_parts[0] if path_parts else parsed.netloc.split(".")[0]
        cleaned = cleaned.strip().lstrip("@").split("/")[0]
        if not cleaned:
            continue
        if cleaned not in seen:
            seen.add(cleaned)
            usernames.append(cleaned)
    return usernames


