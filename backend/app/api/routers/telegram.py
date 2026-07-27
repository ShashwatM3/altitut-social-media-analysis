"""Telegram bot webhook."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.config import settings
from app.firebase_client import COLLECTIONS, db
from app.models import TelegramUpdate
from app.services.pack_service import datetime_now, fetch_packs, save_pack
from app.services.reel_service import build_content_pack_from_reel, extract_instagram_url
from app.services.telegram_client import configured, send_message

router = APIRouter()


def _already_processed(update_id: int) -> bool:
    ref = db.collection(COLLECTIONS["telegramUpdates"]).document(str(update_id))
    doc = ref.get()
    if doc.exists:
        return True
    ref.set({"processedAt": datetime_now()})
    return False


@router.post("")
async def telegram_webhook(request: Request, update: TelegramUpdate) -> Response:
    if not configured():
        return Response(status_code=200)

    # Validate Telegram's secret header when a webhook secret is configured.
    expected_secret = settings.telegram_webhook_secret
    if expected_secret:
        received = request.headers.get("x-telegram-bot-api-secret-token")
        if received != expected_secret:
            return Response(status_code=401)

    data = update.model_dump(mode="json") if update else {}
    message = data.get("message") if isinstance(data.get("message"), dict) else None
    if not message:
        return Response(status_code=200)

    update_id = data.get("update_id")
    if isinstance(update_id, int) and _already_processed(update_id):
        return Response(status_code=200)

    chat_id = message.get("chat", {}).get("id")
    text = str(message.get("text", ""))
    if not chat_id or not text:
        return Response(status_code=200)

    reel_url = extract_instagram_url(text)
    if not reel_url:
        send_message(
            chat_id,
            "Send me an Instagram Reel link and I'll build a content pack from it.",
        )
        return Response(status_code=200)

    def on_progress(msg: str) -> None:
        send_message(chat_id, msg)

    try:
        pack_number = len(fetch_packs(COLLECTIONS["contentPacks"])) + 1
        result = await build_content_pack_from_reel(reel_url, pack_number, on_progress)
        pack = result["pack"]
        stored = save_pack(COLLECTIONS["contentPacks"], pack, "telegram-bot")
        from app.services.rag_service import ingest_pack
        ingest_pack(stored, "content-pack")
        tldr = (stored.tldr or "")[:600]
        send_message(
            chat_id,
            f"Done! Built pack \"{stored.name}\" ({stored.id}).\n\nTL;DR:\n{tldr}",
        )
    except Exception as exc:
        send_message(chat_id, f"Could not build a pack from that link: {exc}")

    return Response(status_code=200)
