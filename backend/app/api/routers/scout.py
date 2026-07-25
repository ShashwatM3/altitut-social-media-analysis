"""Competitor Scout client-driven workflow."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.firebase_client import COLLECTIONS
from app.models import AnalysisPack, ScoutState
from app.services.pack_service import save_pack
from app.services.rag_service import ingest_pack
from app.services.scout_service import (
    assemble_pack,
    step_discover,
    step_research,
    step_social,
    step_synthesize_identity,
    step_synthesize_social,
    step_synthesize_verdict,
    step_website,
)

router = APIRouter()

_STEP_HANDLERS = {
    "discover": step_discover,
    "website": step_website,
    "social": step_social,
    "research": step_research,
    "synthesize-identity": step_synthesize_identity,
    "synthesize-social": step_synthesize_social,
    "synthesize-verdict": step_synthesize_verdict,
}


@router.post("/step/{step_id}")
async def run_scout_step(step_id: str, state: ScoutState) -> ScoutState:
    handler = _STEP_HANDLERS.get(step_id)
    if not handler:
        raise HTTPException(status_code=400, detail=f"Unknown scout step: {step_id}")
    try:
        return await handler(state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/assemble")
def assemble_scout_pack(state: ScoutState) -> AnalysisPack:
    try:
        return assemble_pack(state)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/save")
def save_scout_pack(pack: AnalysisPack) -> dict:
    stored = save_pack(COLLECTIONS["competitors"], pack, "competitor-scout")
    ingest_pack(stored, "competitor")
    return {"id": stored.id}
