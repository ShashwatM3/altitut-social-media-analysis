from __future__ import annotations

from pathlib import Path
from typing import Any

from backend import settings


def test_provider_configs_can_read_dotenv_overrides(tmp_path: Path, monkeypatch: Any) -> None:
    (tmp_path / ".env").write_text(
        "\n".join(
            [
                'OPENAI_MODEL=gpt-4.1-mini',
                'OPENAI_BASE_URL=https://example.com/v1',
                'APIFY_ACTOR_ID=apify/custom-actor',
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(settings, "ROOT_DIR", tmp_path)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("APIFY_ACTOR_ID", raising=False)
    monkeypatch.setattr(
        settings,
        "_load_toml",
        lambda path: {
            "app": {"name": "ALTITUT Social Media Analysis API", "version": "0.1.0"},
            "database": {"dsn": "postgresql://localhost", "schema": "public"},
            "provider": {
                "name": "openai-compatible",
                "enabled": True,
                "api_key_env": "OPENAI_API_KEY",
                "base_url": "https://api.openai.com/v1",
                "model": "",
                "docs_url": "https://platform.openai.com/docs",
                "setup_steps": [],
                "timeout_seconds": 60,
                "token_env": "APIFY_TOKEN",
                "actor_id": "apify/instagram-profile-scraper",
                "dataset_id": "",
                "default_platform": "instagram",
            },
        },
    )

    apify = settings.load_apify_config()
    llm = settings.load_llm_config()

    assert apify.actor_id == "apify/custom-actor"
    assert llm.model == "gpt-4.1-mini"
    assert llm.base_url == "https://example.com/v1"
