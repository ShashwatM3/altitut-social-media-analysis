"""Auto-Post composer and publisher endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.firebase_client import COLLECTIONS
from app.models import AutopostState, CaptionRequest, CaptionResponse, MediaInfo, SocialPost
from app.services.autopost_service import (
    delete_step,
    poll_step,
    publish_step,
    retry_step,
    save_step,
    validate_step,
)
from app.services.caption_service import generate_captions
from app.services.pack_service import (
    derive_media_kind_from_pack,
    derive_placement_from_pack,
    derive_platforms_from_pack,
    pack_to_brief,
    pack_to_ground_truth,
)
from app.services.social.accounts import (
    get_social_account,
    resolve_social_account,
    set_social_account_page,
)
from app.services.social.posts import get_social_post

router = APIRouter()


@router.post("/caption", response_model=CaptionResponse)
def caption(req: CaptionRequest) -> CaptionResponse:
    return generate_captions(req)


class ListAccountsRequest(BaseModel):
    platforms: list[str] | None = None


@router.post("/accounts")
def list_accounts(req: ListAccountsRequest | None = None) -> dict[str, Any]:
    platforms = req.platforms if req and req.platforms else ["linkedin", "facebook", "instagram"]
    accounts = []
    for provider in platforms:
        try:
            account = resolve_social_account(provider)  # refresh from Upload-Post
        except Exception as exc:
            account = get_social_account(provider)
            if not account:
                raise HTTPException(status_code=502, detail=str(exc))
        data = account.model_dump(mode="json", exclude_none=True)
        if provider == "linkedin" and account.status == "active":
            try:
                from app.services.social.upload_post_client import list_linkedin_pages

                data["availablePages"] = list_linkedin_pages(account.uploadPostProfile)
            except Exception as exc:
                data["availablePages"] = []
                data["pagesError"] = str(exc)
        accounts.append(data)
    return {"accounts": accounts}


@router.post("/accounts/{provider}/page")
def set_page(provider: str, page_id: str) -> dict[str, str]:
    set_social_account_page(provider, page_id)
    return {"provider": provider, "pageId": page_id}


class AutopostStepRequest(BaseModel):
    step: str
    state: AutopostState


@router.post("")
async def autopost_step(req: AutopostStepRequest) -> dict[str, Any]:
    step = req.step
    state = req.state
    # Ensure the state has a stable post id.
    if not state.postId:
        state = state.model_copy(update={"postId": str(uuid.uuid4())})

    if step == "validate":
        next_state, error = validate_step(state)
    elif step == "publish":
        next_state, error = publish_step(state)
    elif step == "poll":
        next_state, error = poll_step(state)
    elif step == "retry":
        next_state, error = retry_step(state)
    elif step == "save":
        next_state, error = save_step(state)
    elif step == "delete":
        next_state, error = delete_step(state)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown step: {step}")

    if error:
        raise HTTPException(status_code=400, detail=error)

    return {"state": next_state.model_dump(mode="json", exclude_none=True)}


@router.get("/{post_id}", response_model=SocialPost | None)
def get_post(post_id: str) -> SocialPost | None:
    return get_social_post(post_id)


@router.post("/from-pack")
def build_autopost_state_from_pack(pack_id: str) -> dict[str, Any]:
    """Helper: given a content-pack id, pre-build an AutopostState the frontend can use."""
    from app.services.pack_service import fetch_packs

    for collection in (COLLECTIONS["contentPacks"], COLLECTIONS["competitors"]):
        for pack in fetch_packs(collection):
            if pack.id == pack_id:
                platforms = derive_platforms_from_pack(pack)
                ground_truth = pack_to_ground_truth(pack)
                brief = pack_to_brief(pack)
                media_kind = derive_media_kind_from_pack(pack)
                placement = derive_placement_from_pack(pack)
                targets = [
                    {"platform": p, "placement": placement}
                    for p in platforms
                ]
                state = AutopostState(
                    postId=str(uuid.uuid4()),
                    media=MediaInfo(kind=media_kind, urls=[], storagePaths=[]),
                    brief=brief,
                    copy={},
                    targets=targets,
                    packContext=ground_truth,
                )
                return state.model_dump(mode="json", exclude_none=True)
    raise HTTPException(status_code=404, detail="Pack not found")
