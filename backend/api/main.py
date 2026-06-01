from __future__ import annotations

import asyncio
import json
import re
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.connectors.apify import ApifyConnector, ApifyExecutionError, ApifySetupRequiredError
from backend.connectors.exa import (
    ExaConnector,
    ExaExecutionError,
    ExaSetupRequiredError,
    _extract_social_links_from_website as extract_social_links_from_website,
)
from backend.connectors.llm import LlmConnector, LlmExecutionError, LlmSetupRequiredError
from backend.db.competitors import (
    approve_competitor,
    list_competitors,
    record_run,
    reject_competitor,
    save_competitor,
)
from backend.db.posts import approve_post, list_posts, reject_post, save_post
from backend.db.maintenance import refactor_database_records
from backend.settings import load_runtime_config

SOCIAL_LINK_KEYS = {"instagram", "linkedin", "x", "youtube", "tiktok", "facebook", "threads"}
SOCIAL_HOSTNAMES = {
    "instagram.com",
    "linkedin.com",
    "www.linkedin.com",
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "youtube.com",
    "www.youtube.com",
    "tiktok.com",
    "www.tiktok.com",
    "facebook.com",
    "www.facebook.com",
    "threads.net",
    "www.threads.net",
}
DEFAULT_ALTITUT_CONTEXT = (
    "Altitut is an AI-powered entrepreneurship platform for students and early-stage founders. "
    "It combines learning modules, customer discovery tooling, pitch practice, and progress tracking "
    "so users can validate ideas and build startup momentum in one place."
)

runtime = load_runtime_config()
app = FastAPI(title=runtime.app.name, version=runtime.app.version)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


async def llm_status() -> dict[str, Any]:
    return LlmConnector().status().to_dict()


async def competitor_scout(request: dict[str, Any]) -> dict[str, Any]:
    scout_input = _validate_scout_request(request)
    approved_companies = _approved_companies_for_scout()
    scout_input = {**scout_input, "approved_companies": approved_companies}
    llm_connector = LlmConnector()
    exa_connector = ExaConnector()
    llm_integration = llm_connector.status()
    exa_integration = exa_connector.status()

    scout_run_id = f"run_{uuid4().hex}"
    source_statuses = {
        "llm": llm_integration.to_dict(),
        "exa": exa_integration.to_dict(),
    }
    ready_sources: list[tuple[str, Any]] = []
    if llm_integration.ready:
        ready_sources.append(("llm", llm_connector))
    if exa_integration.ready:
        ready_sources.append(("exa", exa_connector))

    if not ready_sources:
        run = record_run(
            run_type="competitor_scout",
            provider="multi-source",
            status="setup_required",
            input_payload=scout_input,
            output_payload=source_statuses,
            error_message="Competitor scouting requires at least one live discovery source.",
            run_id=scout_run_id,
        )
        return {
            "status": "setup_required",
            "integration": source_statuses,
            "run": run,
        }

    tasks = [asyncio.to_thread(connector.scout_competitors, scout_input) for _, connector in ready_sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    executions: dict[str, Any] = {}
    errors: list[str] = []
    for (source_name, _), result in zip(ready_sources, results, strict=False):
        if isinstance(result, Exception):
            errors.append(f"{source_name}: {result}")
            continue
        executions[source_name] = result

    if not executions:
        run = record_run(
            run_type="competitor_scout",
            provider="multi-source",
            status="failed",
            input_payload=scout_input,
            output_payload={**source_statuses, "errors": errors},
            error_message="All live discovery sources failed.",
            run_id=scout_run_id,
        )
        return {
            "status": "failed",
            "integration": source_statuses,
            "run": run,
            "error": "All live discovery sources failed.",
            "errors": errors,
        }

    merged_candidates = _merge_scout_candidates(
        [execution.candidates for execution in executions.values() if hasattr(execution, "candidates")]
    )
    analyzed_candidates: list[dict[str, Any]] = []
    for index, candidate in enumerate(merged_candidates):
        normalized = _normalize_scout_candidate(candidate, index=index)
        if normalized is None:
            continue
        saved_candidate = save_competitor(normalized, approved=False, source_run_id=scout_run_id)
        if "analysis" in candidate and isinstance(candidate["analysis"], dict):
            saved_candidate["analysis"] = candidate["analysis"]
        analyzed_candidates.append(saved_candidate)

    run = record_run(
        run_type="competitor_scout",
        provider="multi-source",
        status="completed",
        input_payload=scout_input,
        output_payload={
            "candidate_count": len(analyzed_candidates),
            "candidate_ids": [candidate["id"] for candidate in analyzed_candidates],
            "source_statuses": source_statuses,
            "source_runs": {
                source_name: {
                    "run_id": getattr(execution, "run_id", None),
                    "raw_response": getattr(execution, "raw_response", {}),
                    "search_queries": getattr(execution, "search_queries", None),
                }
                for source_name, execution in executions.items()
            },
            "errors": errors,
        },
        run_id=scout_run_id,
    )
    return {
        "status": "completed",
        "integration": source_statuses,
        "run": run,
        "candidate_count": len(analyzed_candidates),
        "candidates": analyzed_candidates,
        "errors": errors,
    }


async def create_competitor(candidate: dict[str, Any]) -> dict[str, Any]:
    payload = _validate_competitor_payload(candidate)
    return save_competitor(payload, approved=False, source_run_id=payload.get("source_run_id"))


async def approve_competitor_route(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return approve_competitor(competitor_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def reject_competitor_route(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return reject_competitor(competitor_id, source_run_id=source_run_id)
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


async def reject_post_route(post_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return reject_post(post_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def refactor_database() -> dict[str, Any]:
    return refactor_database_records()


async def posts_analysis(request: dict[str, Any]) -> dict[str, Any]:
    analysis_input, missing_requirements, next_steps = _resolve_posts_analysis_request(request)
    connector = ApifyConnector()
    integration = connector.status()
    llm = LlmConnector()
    llm_integration = llm.status()

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

    if not llm_integration.ready:
        llm_setup_response = llm_integration.to_dict()
        llm_details = dict(llm_setup_response.get("details", {}))
        llm_details["requested_targets"] = analysis_input["targets"]
        setup_response = {**llm_setup_response, "details": llm_details}
        run = record_run(
            run_type="posts_analysis",
            provider=llm_integration.provider,
            status="setup_required",
            input_payload=analysis_input,
            output_payload=setup_response,
            error_message="LLM setup required before posts analysis can run.",
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

    existing_competitor_ids = {row["id"] for row in list_competitors()}
    prepared_posts: list[dict[str, Any]] = []
    analysis_errors: list[str] = []

    for post in execution.posts:
        competitor_id = post["competitor_id"]
        if competitor_id not in existing_competitor_ids:
            analysis_errors.append(f"{competitor_id}: approved competitor missing")
            break
        try:
            analysis = llm.analyze_post(
                post,
                context={
                    "analysis_input": analysis_input,
                    "apify_run_ids": execution.run_ids,
                    "dataset_ids": execution.dataset_ids,
                },
            )
        except (LlmSetupRequiredError, LlmExecutionError) as exc:
            analysis_errors.append(f"{post['id']}: {exc}")
            break
        prepared_posts.append(
            {
                **post,
                "analysis": analysis,
            }
        )

    if analysis_errors:
        run = record_run(
            run_type="posts_analysis",
            provider=llm_integration.provider,
            status="failed",
            input_payload=analysis_input,
            output_payload={
                "apify_run_ids": execution.run_ids,
                "dataset_ids": execution.dataset_ids,
                "raw_item_count": len(execution.raw_items),
                "analysis_errors": analysis_errors,
                "post_count": len(prepared_posts),
            },
            error_message="LLM post analysis failed.",
        )
        return {
            "status": "failed",
            "integration": integration.to_dict(),
            "llm_integration": llm_integration.to_dict(),
            "run": run,
            "error": "LLM post analysis failed.",
            "analysis_errors": analysis_errors,
        }

    saved_posts: list[dict[str, Any]] = []
    for post in prepared_posts:
        saved_post = save_post(post, approved=False, source_run_id=post["source_run_id"])
        saved_post["competitor_name"] = post["competitor_name"]
        saved_post["analysis"] = post["analysis"]
        saved_posts.append(saved_post)

    run = record_run(
        run_type="posts_analysis",
        provider=llm_integration.provider,
        status="completed",
        input_payload=analysis_input,
        output_payload={
            "apify_run_ids": execution.run_ids,
            "dataset_ids": execution.dataset_ids,
            "raw_item_count": len(execution.raw_items),
            "post_count": len(saved_posts),
            "post_ids": [post["id"] for post in saved_posts],
            "llm": llm_integration.to_dict(),
        },
    )
    return {
        "status": "completed",
        "integration": integration.to_dict(),
        "llm_integration": llm_integration.to_dict(),
        "run": run,
        "post_count": len(saved_posts),
        "posts": saved_posts,
    }


app.add_api_route("/", root, methods=["GET"])
app.add_api_route("/health", health, methods=["GET"])
app.add_api_route("/integrations/apify/status", apify_status, methods=["GET"])
app.add_api_route("/integrations/llm/status", llm_status, methods=["GET"])
app.add_api_route("/competitor-scout", competitor_scout, methods=["POST"])
app.add_api_route("/competitors", get_competitors, methods=["GET"])
app.add_api_route("/competitors", create_competitor, methods=["POST"])
app.add_api_route("/competitors/{competitor_id}/approve", approve_competitor_route, methods=["POST"])
app.add_api_route("/competitors/{competitor_id}/reject", reject_competitor_route, methods=["POST"])
app.add_api_route("/posts-analyze", posts_analysis, methods=["POST"])
app.add_api_route("/posts", get_posts, methods=["GET"])
app.add_api_route("/posts/{post_id}/approve", approve_post_route, methods=["POST"])
app.add_api_route("/posts/{post_id}/reject", reject_post_route, methods=["POST"])
app.add_api_route("/database/refactor", refactor_database, methods=["POST"])


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
    if payload.get("usernames") or payload.get("profile_urls"):
        raise HTTPException(status_code=422, detail="Posts analysis only accepts approved competitor_ids.")

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

    if not targets and not missing_requirements:
        missing_requirements.append("competitor_ids")
        next_steps.append("Select approved competitors before running posts analysis.")

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

    for key in ("website", "source_url", "instagram_url", "instagramUrl", "profile_url", "profileUrl"):
        value = candidate.get(key)
        if isinstance(value, str) and value.strip():
            usernames = _coerce_instagram_usernames([value], key)
            if usernames:
                return usernames[0]
    return None


def _approved_companies_for_scout() -> list[dict[str, Any]]:
    approved_competitors = list_competitors(approved=True)
    return [
        {
            "id": competitor.get("id"),
            "name": competitor.get("name"),
            "website": competitor.get("website"),
            "social_links": competitor.get("social_links") or {},
        }
        for competitor in approved_competitors
        if isinstance(competitor, dict)
    ]


def _validate_scout_request(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    focus_keywords = _coerce_string_list(payload.get("focus_keywords"), "focus_keywords")
    notes = _coerce_string_list(payload.get("notes"), "notes")
    altitut_context = _optional_text(payload.get("altitut_context")).strip() or DEFAULT_ALTITUT_CONTEXT
    return {
        "altitut_context": altitut_context,
        "focus_keywords": focus_keywords,
        "notes": notes,
    }


def _normalize_scout_candidate(candidate: dict[str, Any], *, index: int) -> dict[str, Any] | None:
    if not isinstance(candidate, dict):
        raise HTTPException(status_code=422, detail="Each scout candidate must be an object.")

    name = _require_text(candidate.get("name"), "name")
    candidate_id = _optional_text(candidate.get("id")) or _slugify_competitor_id(name) or f"competitor-{index + 1}"
    website_value = candidate.get("website")
    website = None
    if isinstance(website_value, str) and website_value.strip():
        website = website_value.strip()
    social_links = _coerce_string_mapping(candidate.get("social_links"), "social_links")
    filtered_social_links = {
        key: value
        for key, value in social_links.items()
        if key.lower() in SOCIAL_LINK_KEYS and isinstance(value, str) and value.strip()
    }
    if not filtered_social_links and website:
        filtered_social_links = extract_social_links_from_website(website)
    if not filtered_social_links:
        return None
    relevance_summary = _require_text(candidate.get("relevance_summary"), "relevance_summary")
    traction_summary = _require_text(candidate.get("traction_summary"), "traction_summary")
    result = {
        "id": candidate_id,
        "name": name,
        "website": website,
        "social_links": filtered_social_links,
        "relevance_summary": relevance_summary,
        "traction_summary": traction_summary,
    }
    analysis = candidate.get("analysis")
    if isinstance(analysis, dict):
        result["analysis"] = analysis
    return result


def _merge_scout_candidates(candidate_sets: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for candidates in candidate_sets:
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            key = _candidate_merge_key(candidate)
            existing = merged.get(key)
            if existing is None:
                merged[key] = dict(candidate)
                order.append(key)
                continue
            existing_social_links = (
                {key: value for key, value in existing["social_links"].items()}
                if isinstance(existing.get("social_links"), dict)
                else {}
            )
            candidate_social_links = (
                {key: value for key, value in candidate["social_links"].items()}
                if isinstance(candidate.get("social_links"), dict)
                else {}
            )
            existing["social_links"] = {**existing_social_links, **candidate_social_links}
            for field in ("website", "relevance_summary", "traction_summary"):
                if not existing.get(field) and candidate.get(field):
                    existing[field] = candidate[field]
            if isinstance(candidate.get("analysis"), dict):
                existing_analysis = existing.get("analysis") if isinstance(existing.get("analysis"), dict) else {}
                existing["analysis"] = {**existing_analysis, **candidate["analysis"]}
    return [merged[key] for key in order]


def _candidate_merge_key(candidate: dict[str, Any]) -> str:
    website = _optional_text(candidate.get("website"))
    if website:
        parsed = urlparse(website)
        hostname = (parsed.netloc or parsed.path).lower().removeprefix("www.")
        if hostname in SOCIAL_HOSTNAMES:
            normalized_path = parsed.path.rstrip("/")
            return f"social:{hostname}{normalized_path}"
        domain = hostname
        if domain:
            return f"domain:{domain}"
    candidate_id = _optional_text(candidate.get("id"))
    if candidate_id:
        return f"id:{candidate_id.lower()}"
    name = _optional_text(candidate.get("name"))
    return f"name:{_slugify_competitor_id(name or 'candidate')}"


def _slugify_competitor_id(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:80]


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


def _maybe_parse_json(value: Any) -> Any:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _coerce_string_mapping(value: Any, field_name: str) -> dict[str, str]:
    if value is None:
        return {}
    if isinstance(value, str):
        parsed = _maybe_parse_json(value)
        if isinstance(parsed, dict):
            return _coerce_string_mapping(parsed, field_name)
        if _looks_like_url(value):
            return {_infer_social_link_key(value, field_name=field_name): value.strip()}
        return {}
    if isinstance(value, (list, tuple, set)):
        result: dict[str, str] = {}
        for index, item in enumerate(value):
            result.update(_coerce_social_links(item, field_name=field_name, index=index))
        return result
    if not isinstance(value, dict):
        raise HTTPException(status_code=422, detail=f"{field_name} must be an object.")
    result: dict[str, str] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            continue
        result.update(_coerce_social_links(item, field_name=key, index=0))
    return result


def _coerce_social_links(value: Any, *, field_name: str = "social_links", index: int = 0) -> dict[str, str]:
    if value is None:
        return {}
    if isinstance(value, dict):
        result: dict[str, str] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                continue
            if isinstance(item, str) and item.strip():
                result[key.strip().lower()] = item.strip()
            elif item is not None:
                text = str(item).strip()
                if text and _looks_like_url(text):
                    result[_infer_social_link_key(text, field_name=key)] = text
        return result
    if isinstance(value, str):
        parsed = _maybe_parse_json(value)
        if isinstance(parsed, dict):
            return _coerce_social_links(parsed, field_name=field_name, index=index)
        text = value.strip()
        if text and _looks_like_url(text):
            return {_infer_social_link_key(text, field_name=field_name, index=index): text}
        return {}
    if isinstance(value, (list, tuple, set)):
        result: dict[str, str] = {}
        for item_index, item in enumerate(value):
            for key, url in _coerce_social_links(item, field_name=field_name, index=item_index).items():
                result.setdefault(key, url)
        return result
    text = str(value).strip()
    if text and _looks_like_url(text):
        return {_infer_social_link_key(text, field_name=field_name, index=index): text}
    return {}


def _looks_like_url(value: str) -> bool:
    return value.startswith(("http://", "https://"))


def _infer_social_link_key(url: str, *, field_name: str = "social_links", index: int = 0) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    if "instagram.com" in host:
        return "instagram"
    if "linkedin.com" in host:
        return "linkedin"
    if host in {"x.com", "twitter.com"}:
        return "x"
    if "youtube.com" in host or host == "youtu.be":
        return "youtube"
    if "tiktok.com" in host:
        return "tiktok"
    if "facebook.com" in host or host == "fb.com":
        return "facebook"
    if "threads.net" in host:
        return "threads"
    if field_name and field_name.lower() in SOCIAL_LINK_KEYS:
        return field_name.lower()
    return host or f"link_{index + 1}"


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


