"""Auto-Post step handlers."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.config import settings
from app.models import AutopostState, Provider, SocialPost, UploadPostResult
from app.services.pack_service import datetime_now
from app.services.social import upload_post_client
from app.services.social.accounts import resolve_social_account
from app.services.social.posts import delete_social_post, save_social_post


def _compute_status(results: list[UploadPostResult]) -> str:
    statuses = [r.status for r in results]
    if all(s == "success" for s in statuses):
        return "published"
    if all(s in ("failed", "skipped") for s in statuses):
        return "failed"
    if any(s == "success" for s in statuses):
        return "partial"
    if any(s == "pending" for s in statuses):
        return "publishing"
    return "failed"


def _media_url_reachable(url: str) -> bool:
    try:
        with httpx.Client(timeout=20) as client:
            head = client.head(url)
            if head.is_success:
                return True
            if head.status_code in (405, *range(500, 600)):
                get = client.get(url)
                return get.is_success
            return False
    except Exception:
        return False


def _validate_limits(state: AutopostState) -> str | None:
    for target in state.targets:
        copy = state.copy.get(target.platform)
        if not copy or not copy.caption.strip():
            return f"{target.platform} caption is empty."
        if target.platform == "linkedin" and len(copy.caption) > 3000:
            return "LinkedIn caption exceeds 3,000 characters."
        if target.platform == "instagram" and len(copy.caption) > 2200:
            return "Instagram caption exceeds 2,200 characters."
    return None


def validate_step(state: AutopostState) -> tuple[AutopostState, str | None]:
    if not settings.upload_post_api_key:
        return state, "UPLOAD_POST_API_KEY is not set."
    if not settings.upload_post_profile:
        return state, "UPLOAD_POST_PROFILE is not set."
    if not state.targets:
        return state, "Select at least one platform."

    limit_error = _validate_limits(state)
    if limit_error:
        return state, limit_error

    has_video = state.media.kind == "video"
    has_image = state.media.kind == "image"

    if any(t.platform == "instagram" for t in state.targets) and state.media.kind == "none":
        return state, "Instagram requires a photo or video."
    if not state.media.urls and state.media.kind != "none":
        return state, "Media is missing a public URL. Re-upload the file."
    if has_image and len(state.media.urls) > 10:
        return state, "Instagram carousels are limited to 10 images."

    non_instagram = [t for t in state.targets if t.platform != "instagram"]
    if has_video and has_image and non_instagram:
        return state, "Mixed photo+video posts are only supported on Instagram."

    for url in state.media.urls:
        if not _media_url_reachable(url):
            return state, f"Media URL is not reachable: {url[:80]}..."

    if state.scheduledFor:
        try:
            scheduled = datetime.fromisoformat(state.scheduledFor)
        except Exception:
            return state, "Invalid scheduled date."
        now = datetime.now(timezone.utc)
        if scheduled <= now:
            return state, "Scheduled date must be in the future."
        if (scheduled - now).days > 365:
            return state, "Scheduled date must be within 365 days."

    next_state = state.model_copy(update={
        "availablePages": None,
        "warnings": list(state.warnings or []),
        "results": list(state.results or []),
    })
    ready_targets: list = []

    def set_result(platform: Provider, result: UploadPostResult) -> None:
        results = list(next_state.results or [])
        idx = next((i for i, r in enumerate(results) if r.platform == platform), -1)
        if idx >= 0:
            results[idx] = result
        else:
            results.append(result)
        next_state.results = results

    for target in state.targets:
        try:
            account = resolve_social_account(target.platform)
            if account.status == "needs_reauth":
                next_state.warnings.append(f"{target.platform} is not connected and will be skipped.")
                set_result(target.platform, UploadPostResult(platform=target.platform, status="skipped", error="Account not connected in Upload-Post."))
                continue
            if target.platform == "facebook" and not account.facebookPageId:
                next_state.warnings.append(f"{target.platform}: no Facebook Page found; skipped.")
                set_result(target.platform, UploadPostResult(platform=target.platform, status="skipped", error="No Facebook Page connected to this profile."))
                continue
            target.pageId = (
                account.facebookPageId
                if target.platform == "facebook"
                else account.linkedinPageId
                if target.platform == "linkedin"
                else None
            )
            ready_targets.append(target)
        except Exception as exc:
            next_state.warnings.append(f"{target.platform}: {exc}; skipped.")
            set_result(target.platform, UploadPostResult(platform=target.platform, status="skipped", error=str(exc)))

    next_state.targets = ready_targets
    if not ready_targets:
        return next_state, "None of the selected platforms are connected. Check AUTOPOST_SETUP.md."

    return next_state, None


def publish_step(state: AutopostState) -> tuple[AutopostState, str | None]:
    try:
        res = upload_post_client.publish_to_upload_post(state)
    except Exception as exc:
        return state, str(exc)

    if res.get("availablePages"):
        return state.model_copy(update={"availablePages": res["availablePages"]}), "Multiple Facebook Pages are connected. Pick one and retry."

    next_results: list[UploadPostResult] = list(state.results or [])
    for r in res.get("results") or []:
        idx = next((i for i, x in enumerate(next_results) if x.platform == r.platform), -1)
        if idx >= 0:
            next_results[idx] = r
        else:
            next_results.append(r)
    for target in state.targets:
        if not any(r.platform == target.platform for r in next_results):
            next_results.append(UploadPostResult(platform=target.platform, status="pending"))

    done = _compute_status(next_results) != "publishing"
    status = _compute_status(next_results) if done else ("scheduled" if state.scheduledFor else "publishing")
    next_state = state.model_copy(update={
        "vendorRequestId": res.get("requestId"),
        "jobId": res.get("jobId"),
        "results": next_results,
        "done": done,
        "status": status,
    })
    return next_state, None


def poll_step(state: AutopostState) -> tuple[AutopostState, str | None]:
    id_value = state.jobId or state.vendorRequestId
    if not id_value:
        return state, "No vendor request ID to poll."

    try:
        kind = "job" if state.jobId else "request"
        res = upload_post_client.check_upload_post_status(id_value, kind)
    except Exception as exc:
        return state, str(exc)

    next_results: list[UploadPostResult] = list(state.results or [])
    for r in res.get("results") or []:
        idx = next((i for i, x in enumerate(next_results) if x.platform == r.platform), -1)
        if idx >= 0:
            next_results[idx] = r
        else:
            next_results.append(r)

    done = bool(res.get("done"))
    next_state = state.model_copy(update={"results": next_results, "done": done})
    if done:
        next_state.status = _compute_status(next_results)
    return next_state, None


def save_step(state: AutopostState) -> tuple[AutopostState, str | None]:
    try:
        post = SocialPost(
            id=state.postId,
            createdAt=datetime_now(),
            status=state.status or "publishing",
            warnings=state.warnings,
            media=state.media,
            brief=state.brief,
            copy=state.copy,
            targets=state.targets,
            scheduledFor=state.scheduledFor,
            timezone=state.timezone,
            vendor="upload_post",
            vendorRequestId=state.vendorRequestId,
            jobId=state.jobId,
            results=state.results or [],
        )
        save_social_post(post)
        return state, None
    except Exception as exc:
        return state, str(exc)


def delete_step(state: AutopostState) -> tuple[AutopostState, str | None]:
    errors: list[str] = []
    for result in state.results or []:
        if result.platform == "instagram" or not result.platformPostId:
            continue
        try:
            upload_post_client.unpublish_on_upload_post(result.platform, result.platformPostId, settings.upload_post_profile or "")
        except Exception as exc:
            errors.append(f"{result.platform}: {exc}")

    try:
        delete_social_post(state.postId)
    except Exception as exc:
        return state, str(exc)

    if errors:
        return state, "; ".join(errors)
    return state, None


def compute_status_from_results(results: list[UploadPostResult]) -> str:
    return _compute_status(results)
