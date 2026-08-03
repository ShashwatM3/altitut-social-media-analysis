"""Connected social account resolution and caching."""

from __future__ import annotations

import logging
import threading
from typing import Any

from app.firebase_client import COLLECTIONS, db
from app.models import Provider, SocialAccount
from app.services.pack_service import datetime_now
from app.services.social import upload_post_client

logger = logging.getLogger(__name__)
_USER_PROFILE_UNSET = object()
_account_cache_available: bool | None = None
_account_cache_lock = threading.Lock()


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
    global _account_cache_available
    if _account_cache_available is False:
        return None
    with _account_cache_lock:
        if _account_cache_available is False:
            return None
        try:
            ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
            doc = ref.get()
            _account_cache_available = True
            if doc.exists:
                data = doc.to_dict()
                data["provider"] = provider
                return SocialAccount.model_validate(data)
        except Exception:
            # Firestore is only a cache for account metadata. Account discovery
            # and publishing continue through Upload-Post locally.
            _account_cache_available = False
            logger.warning(
                "Firebase Admin is unavailable; using Upload-Post directly for accounts."
            )
    return None


def resolve_social_account(
    provider: Provider,
    profile: str | None = None,
    user_profile: Any = _USER_PROFILE_UNSET,
) -> SocialAccount:
    global _account_cache_available
    from app.config import settings

    profile = profile or settings.upload_post_profile
    if not profile:
        raise ValueError("UPLOAD_POST_PROFILE is not set.")

    existing = get_social_account(provider)

    if user_profile is _USER_PROFILE_UNSET:
        user_profile = upload_post_client.get_user_profile(profile)
    social_accounts = upload_post_client.get_social_accounts(user_profile)
    connected = _is_connected(provider, social_accounts)
    display_name = (
        _display_name(provider, social_accounts)
        if connected
        else f"{provider} ({profile})"
    )

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
        if existing and existing.linkedinPageId:
            account.linkedinPageId = existing.linkedinPageId

    if provider == "instagram" and connected and social_accounts:
        raw = social_accounts.get("instagram")
        if isinstance(raw, dict):
            account.instagramUserId = (
                str(raw.get("user_id") or "")
                or str(raw.get("id") or "")
                or (existing.instagramUserId if existing else None)
            )

    if _account_cache_available is not False:
        try:
            ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
            data = account.model_dump(mode="json", exclude_none=True)
            if existing:
                ref.update(data)
            else:
                ref.set(data)
        except Exception:
            _account_cache_available = False

    return account


def resolve_social_accounts(
    providers: list[Provider],
    profile: str | None = None,
) -> dict[Provider, SocialAccount]:
    """Resolve several destinations with one Upload-Post profile request."""
    from app.config import settings

    profile = profile or settings.upload_post_profile
    if not profile:
        raise ValueError("UPLOAD_POST_PROFILE is not set.")
    user_profile = upload_post_client.get_user_profile(profile)
    return {
        provider: resolve_social_account(
            provider,
            profile=profile,
            user_profile=user_profile,
        )
        for provider in providers
    }


def set_social_account_page(provider: str, page_id: str) -> None:
    ref = db.collection(COLLECTIONS["socialAccounts"]).document(provider)
    ref.update({f"{provider}PageId": page_id, "updatedAt": datetime_now()})
