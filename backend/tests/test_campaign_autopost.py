from __future__ import annotations

from typing import Any

from app.models import (
    AutopostState,
    AutopostTarget,
    MediaInfo,
    MediaItemInfo,
    PlatformCaption,
    UploadPostResult,
)
from app.services import autopost_service
from app.services.social import upload_post_client


def _state(target: AutopostTarget, caption: str = "A useful post") -> AutopostState:
    return AutopostState(
        postId="campaign-revision-1",
        media=MediaInfo(
            kind="image",
            urls=["https://example.com/one.jpg", "https://example.com/two.jpg"],
            storagePaths=["one.jpg", "two.jpg"],
            width=1080,
            height=1350,
            bytes=2_000_000,
            items=[
                MediaItemInfo(
                    url="https://example.com/one.jpg",
                    path="one.jpg",
                    width=1080,
                    height=1350,
                    bytes=1_000_000,
                ),
                MediaItemInfo(
                    url="https://example.com/two.jpg",
                    path="two.jpg",
                    width=1080,
                    height=1350,
                    bytes=1_000_000,
                ),
            ],
        ),
        copy={
            target.platform: PlatformCaption(
                caption=caption,
                firstComment="Start the conversation",
            )
        },
        targets=[target],
    )


def _fields_as_dict(fields: list[tuple[str, Any]]) -> dict[str, list[str]]:
    parsed: dict[str, list[str]] = {}
    for key, raw in fields:
        value = raw[1] if isinstance(raw, tuple) else raw
        parsed.setdefault(key, []).append(str(value))
    return parsed


def test_instagram_campaign_options_reach_upload_post(monkeypatch: Any) -> None:
    captured: dict[str, Any] = {}

    def fake_fetch(path: str, **kwargs: Any) -> dict[str, Any]:
        captured.update(path=path, **kwargs)
        return {
            "success": True,
            "request_id": "request-1",
            "results": {
                "instagram": {
                    "success": True,
                    "status": "completed",
                    "post_id": "ig-1",
                }
            },
        }

    monkeypatch.setattr(upload_post_client, "upload_post_fetch", fake_fetch)
    state = _state(
        AutopostTarget(
            platform="instagram",
            placement="feed",
            collaborators=["altitut", "founder.name"],
            locationId="123456",
        )
    )

    upload_post_client.publish_to_upload_post(state)

    assert captured["path"] == "/upload_photos"
    fields = _fields_as_dict(captured["files"])
    assert fields["photos[]"] == [
        "https://example.com/one.jpg",
        "https://example.com/two.jpg",
    ]
    assert fields["collaborators"] == ["altitut,founder.name"]
    assert fields["location_id"] == ["123456"]
    assert fields["instagram_first_comment"] == ["Start the conversation"]
    assert captured["idempotency_key"] == "campaign-revision-1"


def test_linkedin_campaign_can_choose_profile_or_company_page(monkeypatch: Any) -> None:
    calls: list[dict[str, list[str]]] = []

    def fake_fetch(path: str, **kwargs: Any) -> dict[str, Any]:
        calls.append(_fields_as_dict(kwargs["files"]))
        return {"success": True, "request_id": "request-2", "results": {}}

    monkeypatch.setattr(upload_post_client, "upload_post_fetch", fake_fetch)

    upload_post_client.publish_to_upload_post(
        _state(
            AutopostTarget(
                platform="linkedin",
                placement="feed",
                postToProfile=True,
                pageId="urn:li:organization:ignored",
            )
        )
    )
    upload_post_client.publish_to_upload_post(
        _state(
            AutopostTarget(
                platform="linkedin",
                placement="feed",
                pageId="urn:li:organization:123",
            )
        )
    )

    assert "target_linkedin_page_id" not in calls[0]
    assert calls[1]["target_linkedin_page_id"] == ["urn:li:organization:123"]
    assert calls[1]["visibility"] == ["PUBLIC"]
    assert calls[1]["linkedin_description"] == ["A useful post"]


def test_campaign_copy_limits_are_checked_before_upload() -> None:
    linkedin = _state(AutopostTarget(platform="linkedin", placement="feed"))
    linkedin.copy["linkedin"].firstComment = "x" * 1251
    assert autopost_service._validate_limits(linkedin) == (
        "LinkedIn first comment exceeds 1,250 characters."
    )

    instagram = _state(AutopostTarget(platform="instagram", placement="feed"))
    instagram.copy["instagram"].firstComment = "x" * 2197
    assert autopost_service._validate_limits(instagram) == (
        "Instagram first comment exceeds 2,196 characters."
    )


def test_every_campaign_image_is_validated() -> None:
    instagram = _state(AutopostTarget(platform="instagram", placement="feed"))
    assert instagram.media.items
    instagram.media.items[1].width = 2000
    instagram.media.items[1].height = 500
    assert autopost_service.validate_step(instagram)[1] == (
        "Instagram image 2 must be between 4:5 and 1.91:1."
    )

    linkedin = _state(AutopostTarget(platform="linkedin", placement="feed"))
    assert linkedin.media.items
    linkedin.media.items[1].bytes = 8 * 1024 * 1024 + 1
    assert autopost_service.validate_step(linkedin)[1] == (
        "Image 2 exceeds the 8 MB file-size limit."
    )


def test_invalid_instagram_collaborator_is_rejected() -> None:
    state = _state(
        AutopostTarget(
            platform="instagram",
            placement="feed",
            collaborators=["not valid"],
        )
    )
    assert autopost_service._validate_limits(state) == (
        "Instagram collaborator 'not valid' is invalid. Use public usernames without @."
    )


def test_retry_reuses_vendor_request_and_marks_failed_result_pending(
    monkeypatch: Any,
) -> None:
    retried: list[tuple[str, str]] = []
    monkeypatch.setattr(
        upload_post_client,
        "retry_upload_post",
        lambda value, kind: retried.append((value, kind)),
    )
    state = _state(AutopostTarget(platform="instagram", placement="feed")).model_copy(
        update={
            "vendorRequestId": "request-123",
            "results": [
                UploadPostResult(
                    platform="instagram",
                    status="failed",
                    error="temporary vendor error",
                )
            ],
            "status": "failed",
            "done": True,
        }
    )

    next_state, error = autopost_service.retry_step(state)

    assert error is None
    assert retried == [("request-123", "request")]
    assert next_state.status == "publishing"
    assert next_state.done is False
    assert next_state.results and next_state.results[0].status == "pending"
    assert next_state.results[0].error is None
