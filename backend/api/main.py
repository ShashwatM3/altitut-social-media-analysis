from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.connectors.apify import ApifyConnector
from backend.db.competitors import approve_competitor, list_competitors, record_run, save_competitor
from backend.settings import load_runtime_config

runtime = load_runtime_config()
app = FastAPI(title=runtime.app.name, version=runtime.app.version)


class CompetitorScoutRequest(BaseModel):
    altitut_context: str = Field(min_length=10)
    focus_keywords: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class CompetitorPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    website: str | None = None
    social_links: dict[str, str] = Field(default_factory=dict)
    relevance_summary: str = Field(min_length=1)
    traction_summary: str = Field(min_length=1)
    source_run_id: str | None = None


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "ALTITUT Social Media Analysis API", "status": "ok"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": runtime.app.name,
        "version": runtime.app.version,
    }


@app.get("/integrations/apify/status")
async def apify_status() -> dict[str, Any]:
    return ApifyConnector().status().to_dict()


@app.post("/competitor-scout")
async def competitor_scout(request: CompetitorScoutRequest) -> dict[str, Any]:
    integration = ApifyConnector().status()
    scout_input = request.model_dump()
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

    run = record_run(
        run_type="competitor_scout",
        provider=integration.provider,
        status="ready",
        input_payload=scout_input,
        output_payload={
            "message": "Apify is configured and the backend is ready for the next scout execution step.",
        },
    )
    return {
        "status": "ready",
        "integration": integration.to_dict(),
        "run": run,
        "message": "Apify is configured; the discovered-candidate execution step can now be wired into this route.",
    }


@app.get("/competitors")
async def get_competitors(approved: bool | None = None) -> list[dict[str, Any]]:
    return list_competitors(approved=approved)


@app.post("/competitors")
async def create_competitor(candidate: CompetitorPayload) -> dict[str, Any]:
    run_id = candidate.source_run_id or None
    saved = save_competitor(candidate.model_dump(), approved=False, source_run_id=run_id)
    return saved


@app.post("/competitors/{competitor_id}/approve")
async def approve_competitor_route(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    try:
        approved = approve_competitor(competitor_id, source_run_id=source_run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return approved
