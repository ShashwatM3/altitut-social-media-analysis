"""Connected social account resolution and caching."""

from __future__ import annotations

from typing import Any

from app.firebase_client import COLLECTIONS, db
from app.models import Provider, SocialAccount
from app.services.pack_service import datetime_now
from app.services.social import upload_post_client


def _display_name(provider: Provider, social_accounts: dict[str, Any] | None) -> str:
    raw = social_accounts.get(provider) if social_accounts else None
    if not isinstance(raw, dict):
        return provider
    return (
        str(raw.get("display_name") or "")
        or str(raw.get("username") or "")
        or str(raw.get("name") or "")
        or provider
    )


def _is_connected(provider: Provider, social_accounts: dict[str, Any] | None) -> bool:
    raw = social_accounts.get(provider) if social_accounts else None
    return isinstance(raw, dict) and len(raw) > 0


def get_social_account(provider: Provider) -> SocialAccount | None:
    ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
    doc = ref.get()
    if doc.exists:
        data = doc.to_dict()
        data["provider"] = provider
        return SocialAccount.model_validate(data)
    return None


def resolve_social_account(provider: Provider, profile: str | None = None) -> SocialAccount:
    from app.config import settings

    profile = profile or settings.upload_post_profile
    if not profile:
        raise ValueError("UPLOAD_POST_PROFILE is not set.")

    existing = get_social_account(provider)

    user_profile = upload_post_client.get_user_profile(profile)
    social_accounts = upload_post_client.get_social_accounts(user_profile)
    connected = _is_connected(provider, social_accounts)
    display_name = _display_name(provider, social_accounts) if connected else f"{provider} ({profile})"

    account = SocialAccount(
        provider=provider,
        vendor="upload_post",
        uploadPostProfile=profile,
        displayName=display_name,
        status="active" if connected else "needs_reauth",
        connectedAt=existing.connectedAt if existing else datetime_now(),
        updatedAt=datetime_now(),
    )

    if provider == "facebook" and connected:
        if not existing or not existing.facebookPageId:
            try:
                pages = upload_post_client.list_facebook_pages(profile)
                if pages:
                    account.facebookPageId = pages[0]["id"]
            except Exception:
                pass
        else:
            account.facebookPageId = existing.facebookPageId

    if provider == "linkedin" and connected:
        if not existing or not existing.linkedinPageId:
            try:
                pages = upload_post_client.list_linkedin_pages(profile)
                if pages:
                    account.linkedinPageId = pages[0]["id"]
            except Exception:
                pass
        else:
            account.linkedinPageId = existing.linkedinPageId

    if provider == "instagram" and connected and social_accounts:
        raw = social_accounts.get("instagram")
        if isinstance(raw, dict):
            account.instagramUserId = (
                str(raw.get("user_id") or "")
                or str(raw.get("id") or "")
                or (existing.instagramUserId if existing else None)
            )

    ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
    data = account.model_dump(mode="json", exclude_none=True)
    if existing:
        ref.update(data)
    else:
        ref.set(data)

    return account


def set_social_account_page(provider: str, page_id: str) -> None:
    ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
    ref.update({f"{provider}PageId": page_id, "updatedAt": datetime_now()})
