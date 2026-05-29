from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT_DIR / "configs"


def _load_toml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("rb") as handle:
        return tomllib.load(handle)


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


@dataclass
class AppConfig:
    name: str = "ALTITUT Social Media Analysis API"
    version: str = "0.1.0"


@dataclass
class DatabaseConfig:
    dsn: str = "postgresql://localhost"
    schema: str = "public"

    @property
    def resolved_dsn(self) -> str:
        return _env("DATABASE_URL", self.dsn)


@dataclass
class RuntimeConfig:
    app: AppConfig = field(default_factory=AppConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)


@dataclass
class ApifyProviderConfig:
    name: str = "apify"
    enabled: bool = True
    token_env: str = "APIFY_TOKEN"
    actor_id: str = ""
    dataset_id: str = ""
    default_platform: str = "instagram"
    docs_url: str = "https://docs.apify.com/"
    setup_steps: list[str] = field(default_factory=list)

    @property
    def token(self) -> str:
        return _env(self.token_env)


@dataclass
class LlmProviderConfig:
    name: str = "openai-compatible"
    enabled: bool = True
    api_key_env: str = "OPENAI_API_KEY"
    base_url: str = "https://api.openai.com/v1"
    model: str = ""
    docs_url: str = "https://platform.openai.com/docs"
    setup_steps: list[str] = field(default_factory=list)
    timeout_seconds: int = 60
    offline_fallback: bool = True

    @property
    def api_key(self) -> str:
        return _env(self.api_key_env)


def load_runtime_config() -> RuntimeConfig:
    raw = _load_toml(CONFIG_DIR / "runtime.toml")
    app = raw.get("app", {})
    database = raw.get("database", {})
    return RuntimeConfig(
        app=AppConfig(
            name=app.get("name", "ALTITUT Social Media Analysis API"),
            version=app.get("version", "0.1.0"),
        ),
        database=DatabaseConfig(
            dsn=database.get("dsn", "postgresql://localhost"),
            schema=database.get("schema", "public"),
        ),
    )


def load_apify_config() -> ApifyProviderConfig:
    raw = _load_toml(CONFIG_DIR / "providers" / "apify.toml")
    provider = raw.get("provider", {})
    return ApifyProviderConfig(
        name=provider.get("name", "apify"),
        enabled=bool(provider.get("enabled", True)),
        token_env=provider.get("token_env", "APIFY_TOKEN"),
        actor_id=provider.get("actor_id", ""),
        dataset_id=provider.get("dataset_id", ""),
        default_platform=provider.get("default_platform", "instagram"),
        docs_url=provider.get("docs_url", "https://docs.apify.com/"),
        setup_steps=list(provider.get("setup_steps", [])),
    )


def load_llm_config() -> LlmProviderConfig:
    raw = _load_toml(CONFIG_DIR / "providers" / "llm.toml")
    provider = raw.get("provider", {})
    timeout_seconds = provider.get("timeout_seconds", 60)
    try:
        timeout_value = max(1, int(timeout_seconds))
    except (TypeError, ValueError):
        timeout_value = 60
    return LlmProviderConfig(
        name=provider.get("name", "openai-compatible"),
        enabled=bool(provider.get("enabled", True)),
        api_key_env=provider.get("api_key_env", "OPENAI_API_KEY"),
        base_url=provider.get("base_url", "https://api.openai.com/v1"),
        model=provider.get("model", ""),
        docs_url=provider.get("docs_url", "https://platform.openai.com/docs"),
        setup_steps=list(provider.get("setup_steps", [])),
        timeout_seconds=timeout_value,
        offline_fallback=bool(provider.get("offline_fallback", True)),
    )
