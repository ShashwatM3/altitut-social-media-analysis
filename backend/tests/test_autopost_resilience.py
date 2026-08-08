from __future__ import annotations

from typing import Any

from app.api.routers import autopost as autopost_router
from app.models import (
    AutopostState,
    AutopostTarget,
    MediaInfo,
    PlatformCaption,
    SocialAccount,
)
from app.services import autopost_service
from app.services.social import accounts, upload_post_client


class _UnavailableFirestore:
    def collection(self, _name: str) -> Any:
        raise RuntimeError("Firebase Admin credentials are unavailable")


def test_account_discovery_does_not_require_firestore_admin(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(accounts, "db", _UnavailableFirestore())
    monkeypatch.setattr(
        accounts.upload_post_client,
        "get_user_profile",
        lambda _profile: {
            "profile": {
                "social_accounts": {
                    "linkedin": {"display_name": "Altitut LinkedIn"},
                }
            }
        },
    )
    monkeypatch.setattr(
        accounts.upload_post_client,
        "list_linkedin_pages",
        lambda _profile: [],
    )

    account = accounts.resolve_social_account("linkedin", profile="altitut")

    assert account.status == "active"
    assert account.displayName == "Altitut LinkedIn"


def test_history_cache_failure_does_not_turn_a_live_post_into_a_failure(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(
        autopost_service,
        "save_social_post",
        lambda _post: (_ for _ in ()).throw(
            RuntimeError("Firebase Admin credentials are unavailable")
        ),
    )
    state = AutopostState(
        postId="post-already-live",
        status="published",
        media=MediaInfo(kind="none", urls=[], storagePaths=[]),
        copy={"linkedin": PlatformCaption(caption="Already published")},
        targets=[AutopostTarget(platform="linkedin", placement="feed")],
        results=[],
        done=True,
    )

    next_state, error = autopost_service.save_step(state)

    assert error is None
    assert next_state.status == "published"


def test_standard_account_check_does_not_wait_for_optional_linkedin_pages(
    monkeypatch: Any,
) -> None:
    account = SocialAccount(
        provider="linkedin",
        uploadPostProfile="altitut",
        displayName="Altitut LinkedIn",
        status="active",
        connectedAt="2026-08-03T00:00:00Z",
        updatedAt="2026-08-03T00:00:00Z",
    )
    monkeypatch.setattr(
        autopost_router,
        "resolve_social_accounts",
        lambda _providers: {"linkedin": account},
    )
    page_lookups: list[str] = []
    monkeypatch.setattr(
        accounts.upload_post_client,
        "list_linkedin_pages",
        lambda profile: page_lookups.append(profile) or [],
    )

    response = autopost_router.list_accounts(
        autopost_router.ListAccountsRequest(platforms=["linkedin"])
    )

    assert response["accounts"][0]["status"] == "active"
    assert page_lookups == []


def test_completed_job_marks_success_true_result_as_success(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(
        upload_post_client,
        "upload_post_fetch",
        lambda _path: {
            "status": "completed",
            "completed": 1,
            "total": 1,
            "results": [
                {
                    "platform": "linkedin",
                    "success": True,
                    "platform_post_id": "urn:li:share:123",
                    "post_url": "https://www.linkedin.com/feed/update/urn:li:share:123/",
                }
            ],
        },
    )

    status = upload_post_client.check_upload_post_status("job-123", "job")

    assert status["done"] is True
    assert status["results"][0].status == "success"
    assert status["results"][0].postUrl.endswith("urn:li:share:123/")
