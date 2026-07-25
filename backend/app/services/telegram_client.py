"""Telegram Bot API client."""

from __future__ import annotations

import httpx

from app.config import settings


def configured() -> bool:
    return bool(settings.telegram_bot_token)


def _base_url() -> str:
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


def send_message(
    chat_id: int | str,
    text: str,
    *,
    markdown: bool = False,
) -> None:
    """Send a text message to a Telegram chat."""
    if not settings.telegram_bot_token:
        return

    # Truncate to Telegram's max length with a safety margin.
    if len(text) > 4000:
        text = text[:3997] + "..."

    body: dict = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if markdown:
        body["parse_mode"] = "Markdown"

    try:
        with httpx.Client(timeout=15) as client:
            response = client.post(f"{_base_url()}/sendMessage", json=body)
            if response.status_code == 400 and markdown:
                # Retry without Markdown if formatting fails.
                body.pop("parse_mode", None)
                response = client.post(f"{_base_url()}/sendMessage", json=body)
            response.raise_for_status()
    except Exception:
        # Telegram progress messages are best-effort.
        pass
