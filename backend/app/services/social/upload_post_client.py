"""Upload-Post vendor client for LinkedIn/Facebook/Instagram publishing."""

from __future__ import annotations

import urllib.parse
from typing import Any

import httpx

from app.config import settings
from app.models import AutopostState, Provider, UploadPostResult
from app.services.social.errors import SocialPublishError

BASE = settings.upload_post_base_url


def _headers(idempotency_key: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Apikey {settings.upload_post_api_key or ''}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def upload_post_fetch(
    path: str,
    *,
    method: str = "GET",
    data: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    files: list[tuple[str, Any]] | None = None,
    idempotency_key: str | None = None,
) -> Any:
    url = f"{BASE}{path}"
    with httpx.Client(timeout=120) as client:
        if method.upper() == "POST" and files is not None:
            # Multipart/form-data is required by Upload-Post's /upload* endpoints.
            response = client.post(url, data=data, files=files, headers=_headers(idempotency_key))
        elif method.upper() == "POST" and data is not None:
            response = client.post(url, data=data, headers=_headers(idempotency_key))
        elif method.upper() == "POST":
            response = client.post(url, json=json_body, headers=_headers(idempotency_key))
        else:
            response = client.get(url, headers=_headers(idempotency_key))

        try:
            payload = response.json() if response.text else {}
        except Exception:
            payload = {}

        if not response.is_success or payload.get("success") is False:
            raise SocialPublishError(
                code=f"UPLOADPOST_{response.status_code}",
                message=str(
                    payload.get("error")
                    or payload.get("message")
                    or response.reason_phrase
                    or "Upload-Post request failed"
                ),
                retryable=response.status_code == 429 or response.status_code >= 500,
                raw=payload if isinstance(payload, dict) else {},
            )
        return payload


def _as_provider(value: str) -> Provider | None:
    if value in ("linkedin", "facebook", "instagram"):
        return value  # type: ignore[return-value]
    return None


def _raw_results_to_array(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    if isinstance(raw, dict):
        return [{**v, "platform": k} for k, v in raw.items() if isinstance(v, dict)]
    return []


def _extract_post_url(raw: dict[str, Any]) -> str | None:
    return raw.get("url") or raw.get("post_url")


def _extract_platform_post_id(raw: dict[str, Any]) -> str | None:
    return (
        raw.get("platform_post_id")
        or raw.get("publish_id")
        or raw.get("post_id")
        or raw.get("container_id")
        or raw.get("video_id")
        or raw.get("video_reel_id")
        or raw.get("video_urn")
        or ((raw.get("image_urns") or [None])[0])
        or ((raw.get("post_ids") or [None])[0])
    )


def _is_terminal_message(message: str | None) -> bool:
    if not message:
        return False
    lower = message.lower()
    return lower == "published" or lower == "completed" or lower.startswith("fail")


def _map_raw_result(
    raw: dict[str, Any],
    *,
    completed_job: bool = False,
) -> UploadPostResult | None:
    platform = _as_provider(str(raw.get("platform", "")))
    if not platform:
        return None

    status_lower = str(raw.get("status", "")).lower()
    message_lower = str(raw.get("message", "")).lower()

    failed = status_lower in ("failed", "error") or raw.get("success") is False
    skipped = status_lower == "skipped"
    terminal = status_lower in ("completed", "success") or message_lower == "published"
    pending = (
        status_lower in ("pending", "queued", "processing", "in_progress")
        or message_lower == "queued"
    )

    if failed:
        status = "failed"
    elif skipped:
        status = "skipped"
    elif (
        terminal
        or (raw.get("success") is True and _is_terminal_message(raw.get("message")))
        or (completed_job and raw.get("success") is True)
    ):
        status = "success"
    elif pending or raw.get("success") is True:
        status = "pending"
    else:
        status = "pending"

    error = raw.get("error") if isinstance(raw.get("error"), str) else None
    if status == "failed" and raw.get("message") and not error:
        error = str(raw["message"])

    return UploadPostResult(
        platform=platform,
        status=status,  # type: ignore[arg-type]
        postUrl=_extract_post_url(raw),
        platformPostId=_extract_platform_post_id(raw),
        error=error,
    )


def create_profile(profile: str) -> None:
    upload_post_fetch(
        "/uploadposts/users",
        method="POST",
        json_body={"username": profile},
    )


def get_user_profile(profile: str) -> Any:
    encoded = urllib.parse.quote(profile, safe="")
    try:
        return upload_post_fetch(f"/uploadposts/users/{encoded}")
    except SocialPublishError as exc:
        if exc.code == "UPLOADPOST_404":
            create_profile(profile)
            return upload_post_fetch(f"/uploadposts/users/{encoded}")
        raise


def get_social_accounts(user_profile: Any) -> dict[str, Any] | None:
    if not isinstance(user_profile, dict):
        return None
    profile = user_profile.get("profile", user_profile)
    if not isinstance(profile, dict):
        return None
    social_accounts = profile.get("social_accounts")
    if isinstance(social_accounts, dict):
        return social_accounts
    return None


def list_facebook_pages(profile: str) -> list[dict[str, str]]:
    res = upload_post_fetch(f"/uploadposts/facebook/pages?profile={urllib.parse.quote(profile)}")
    if not isinstance(res, dict):
        res = {}
    pages = res.get("pages") or res if isinstance(res, list) else []
    if not isinstance(pages, list):
        return []
    return [
        {
            "id": str(p.get("id") or p.get("page_id") or ""),
            "name": str(p.get("name") or p.get("page_name") or p.get("title") or ""),
        }
        for p in pages
        if isinstance(p, dict)
    ]


def list_linkedin_pages(profile: str) -> list[dict[str, str]]:
    res = upload_post_fetch(f"/uploadposts/linkedin/pages?profile={urllib.parse.quote(profile)}")
    if not isinstance(res, dict):
        res = {}
    pages = res.get("pages") or res.get("linkedin_pages") or (res if isinstance(res, list) else [])
    if not isinstance(pages, list):
        return []
    return [
        {
            "id": str(p.get("id") or p.get("organization_id") or ""),
            "name": str(p.get("name") or p.get("localizedName") or ""),
        }
        for p in pages
        if isinstance(p, dict)
    ]


def publish_to_upload_post(state: AutopostState) -> dict[str, Any]:
    if not settings.upload_post_api_key:
        raise SocialPublishError("CONFIG", "UPLOAD_POST_API_KEY is not set.", retryable=False)
    if not settings.upload_post_profile:
        raise SocialPublishError("CONFIG", "UPLOAD_POST_PROFILE is not set.", retryable=False)

    # Upload-Post's upload endpoints require multipart/form-data, not
    # application/x-www-form-urlencoded. Build a list of (field, (None, value))
    # tuples so httpx sends a multipart body with no file attachments.
    fields: list[tuple[str, Any]] = []

    def _add_field(name: str, value: str | None) -> None:
        if value is not None:
            fields.append((name, (None, value)))

    _add_field("user", settings.upload_post_profile)
    _add_field("async_upload", "true")
    for target in state.targets:
        _add_field("platform[]", target.platform)

    if state.scheduledFor:
        _add_field("scheduled_date", state.scheduledFor)
        _add_field("timezone", state.timezone or "UTC")

    first_target = state.targets[0] if state.targets else None
    first_copy = state.copy.get(first_target.platform) if first_target else None
    fallback_text = first_copy.caption if first_copy else ""
    fallback_title = fallback_text[:200]

    has_video = state.media.kind == "video"
    has_image = state.media.kind == "image"

    if has_video and has_image:
        path = "/upload_photos"
        for url in state.media.urls:
            _add_field("photos[]", url)
    elif has_video:
        path = "/upload"
        if state.media.urls:
            _add_field("video", state.media.urls[0])
    elif has_image:
        path = "/upload_photos"
        for url in state.media.urls:
            _add_field("photos[]", url)
    else:
        path = "/upload_text"

    if fallback_title:
        _add_field("title", fallback_title)
    if fallback_text:
        fb_copy = state.copy.get("facebook")
        description = fb_copy.caption if fb_copy else fallback_text
        if description:
            _add_field("description", description)

    for target in state.targets:
        copy = state.copy.get(target.platform)
        caption = copy.caption if copy else fallback_text
        first_comment = copy.firstComment if copy else ""

        if target.platform == "linkedin":
            if caption:
                _add_field("linkedin_description", caption)
                _add_field("linkedin_title", caption[:400])
            _add_field("visibility", target.visibility or "PUBLIC")
            if target.pageId and not target.postToProfile:
                _add_field("target_linkedin_page_id", target.pageId)
            if first_comment:
                _add_field("linkedin_first_comment", first_comment)

        elif target.platform == "facebook":
            if not target.pageId:
                raise SocialPublishError(
                    "VALIDATION",
                    "Facebook requires a target Page. Connect a Page in Upload-Post and run setup.",
                    retryable=False,
                )
            if target.pageId:
                _add_field("facebook_page_id", target.pageId)
            if caption:
                _add_field("facebook_title", caption)
            if has_video:
                media_type = (
                    "STORIES"
                    if target.placement == "story"
                    else "REELS"
                    if target.placement == "reel"
                    else "VIDEO"
                )
                _add_field("facebook_media_type", media_type)
            elif has_image:
                _add_field(
                    "facebook_media_type", "STORIES" if target.placement == "story" else "POSTS"
                )
            if first_comment:
                _add_field("facebook_first_comment", first_comment)

        elif target.platform == "instagram":
            if caption:
                _add_field("instagram_title", caption)
            if has_video:
                if target.placement == "reel":
                    _add_field("media_type", "REELS")
                if target.placement == "story":
                    _add_field("media_type", "STORIES")
            elif has_image:
                if target.placement == "story":
                    _add_field("media_type", "STORIES")
            if first_comment:
                _add_field("instagram_first_comment", first_comment)
            if target.collaborators:
                _add_field(
                    "collaborators",
                    ",".join(username.removeprefix("@") for username in target.collaborators),
                )
            if target.locationId:
                _add_field("location_id", target.locationId)

    res = upload_post_fetch(path, method="POST", files=fields, idempotency_key=state.postId)
    results = _raw_results_to_array(res.get("results") or res.get("platforms"))
    return {
        "requestId": res.get("request_id"),
        "jobId": res.get("job_id"),
        "results": [r for r in (_map_raw_result(r) for r in results) if r is not None],
        "availablePages": res.get("available_pages")
        if isinstance(res.get("available_pages"), list)
        else None,
    }


def check_upload_post_status(id_value: str, kind: str = "request") -> dict[str, Any]:
    query_key = "job_id" if kind == "job" else "request_id"
    s = upload_post_fetch(f"/uploadposts/status?{query_key}={urllib.parse.quote(id_value)}")
    if not isinstance(s, dict):
        s = {}

    raw_results = _raw_results_to_array(s.get("results") or s.get("platforms"))
    top_status = str(s.get("status", "")).lower()
    terminal_top = top_status in ("completed", "failed", "not_found")

    def is_terminal_result(r: dict[str, Any]) -> bool:
        st = str(r.get("status", "")).lower()
        msg = str(r.get("message", "")).lower()
        return st in ("completed", "success", "failed", "error") or msg in (
            "published",
            "completed",
        )

    done = terminal_top or (
        len(raw_results) > 0 and all(is_terminal_result(r) for r in raw_results)
    )
    return {
        "done": done,
        "results": [
            mapped
            for mapped in (
                _map_raw_result(result, completed_job=top_status == "completed")
                for result in raw_results
            )
            if mapped is not None
        ],
    }


def retry_upload_post(id_value: str, kind: str = "request") -> None:
    key = "job_id" if kind == "job" else "request_id"
    upload_post_fetch(
        "/uploadposts/posts/retry",
        method="POST",
        json_body={key: id_value},
    )


def unpublish_on_upload_post(platform: Provider, provider_post_id: str, profile: str) -> None:
    upload_post_fetch(
        "/uploadposts/posts/unpublish",
        method="POST",
        json_body={"platform": platform, "user": profile, "post_id": provider_post_id},
    )
