"""Competitor pack CRUD + RAG ingest."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.firebase_client import COLLECTIONS
from app.models import AnalysisPack, StoredPack
from app.services.pack_service import delete_pack, fetch_packs, save_pack
from app.services.rag_service import ingest_pack, remove_pack_chunks

router = APIRouter()


@router.get("", response_model=list[StoredPack])
def list_competitors() -> list[StoredPack]:
    return fetch_packs(COLLECTIONS["competitors"])


@router.post("", response_model=StoredPack)
def create_competitor(pack: AnalysisPack) -> StoredPack:
    stored = save_pack(COLLECTIONS["competitors"], pack, "competitor-scout")
    ingest_pack(stored, "competitor")
    return stored


@router.get("/{pack_id}", response_model=StoredPack)
def get_competitor(pack_id: str) -> StoredPack:
    for pack in fetch_packs(COLLECTIONS["competitors"]):
        if pack.id == pack_id:
            return pack
    raise HTTPException(status_code=404, detail="Competitor not found")


@router.put("/{pack_id}", response_model=StoredPack)
def update_competitor(pack_id: str, pack: AnalysisPack) -> StoredPack:
    remove_pack_chunks(pack.name)
    stored = save_pack(COLLECTIONS["competitors"], pack, "competitor-scout", pack_id=pack_id)
    ingest_pack(stored, "competitor")
    return stored


@router.delete("/{pack_id}")
def remove_competitor(pack_id: str) -> dict[str, Any]:
    pack = next((p for p in fetch_packs(COLLECTIONS["competitors"]) if p.id == pack_id), None)
    if pack:
        remove_pack_chunks(pack.name)
    delete_pack(COLLECTIONS["competitors"], pack_id)
    return {"deleted": pack_id}
