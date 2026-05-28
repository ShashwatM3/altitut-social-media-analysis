from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException

from backend.connectors.apify import ApifyConnector, ApifyExecutionError, ApifySetupRequiredError
from backend.db.competitors import approve_competitor, list_competitors, record_run, save_competitor
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


async def get_competitors(approved: bool | None = None) -> list[dict[str, Any]]:
    return list_competitors(approved=approved)


async def create_competitor(candidate: dict[str, Any]) -> dict[str, Any]:
    payload = _validate_competitor_payload(candidate)
    return save_competitor(payload, approved=False, source_run_id=payload.get("source_run_id"))


async def approve_competitor_route(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        return approve_competitor(competitor_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


app.add_api_route("/", root, methods=["GET"])
app.add_api_route("/health", health, methods=["GET"])
app.add_api_route("/integrations/apify/status", apify_status, methods=["GET"])
app.add_api_route("/competitor-scout", competitor_scout, methods=["POST"])
app.add_api_route("/competitors", get_competitors, methods=["GET"])
app.add_api_route("/competitors", create_competitor, methods=["POST"])
app.add_api_route("/competitors/{competitor_id}/approve", approve_competitor_route, methods=["POST"])


def _validate_scout_request(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    altitut_context = _require_text(payload.get("altitut_context"), "altitut_context", min_length=10)
    focus_keywords = _coerce_string_list(payload.get("focus_keywords"), "focus_keywords")
    notes = _coerce_string_list(payload.get("notes"), "notes")
    return {
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
