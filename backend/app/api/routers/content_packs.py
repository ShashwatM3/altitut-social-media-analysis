"""Content-pack CRUD + RAG ingest."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.firebase_client import COLLECTIONS
from app.models import AnalysisPack, StoredPack
from app.services.pack_service import delete_pack, fetch_packs, save_pack
from app.services.rag_service import ingest_pack, remove_pack_chunks

router = APIRouter()


@router.get("", response_model=list[StoredPack])
def list_packs() -> list[StoredPack]:
    return fetch_packs(COLLECTIONS["contentPacks"])


@router.post("", response_model=StoredPack)
def create_pack(pack: AnalysisPack) -> StoredPack:
    stored = save_pack(COLLECTIONS["contentPacks"], pack, "seed")
    ingest_pack(stored, "content-pack")
    return stored


@router.get("/{pack_id}", response_model=StoredPack)
def get_pack(pack_id: str) -> StoredPack:
    for pack in fetch_packs(COLLECTIONS["contentPacks"]):
        if pack.id == pack_id:
            return pack
    raise HTTPException(status_code=404, detail="Pack not found")


@router.put("/{pack_id}", response_model=StoredPack)
def update_pack(pack_id: str, pack: AnalysisPack) -> StoredPack:
    remove_pack_chunks(pack.name)
    stored = save_pack(COLLECTIONS["contentPacks"], pack, "seed", pack_id=pack_id)
    ingest_pack(stored, "content-pack")
    return stored


@router.delete("/{pack_id}")
def remove_pack(pack_id: str) -> dict[str, Any]:
    pack = next((p for p in fetch_packs(COLLECTIONS["contentPacks"]) if p.id == pack_id), None)
    if pack:
        remove_pack_chunks(pack.name)
    delete_pack(COLLECTIONS["contentPacks"], pack_id)
    return {"deleted": pack_id}
