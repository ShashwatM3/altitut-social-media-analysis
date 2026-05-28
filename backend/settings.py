from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os
from typing import Any
import tomllib


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


@dataclass(slots=True)
class AppConfig:
    name: str = "ALTITUT Social Media Analysis API"
    version: str = "0.1.0"


@dataclass(slots=True)
class DatabaseConfig:
    dsn: str = "postgresql://localhost:5432/altitut_social_media_analysis"
    schema: str = "public"

    @property
    def resolved_dsn(self) -> str:
        return _env("DATABASE_URL", self.dsn)


@dataclass(slots=True)
class RuntimeConfig:
    app: AppConfig = field(default_factory=AppConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)


@dataclass(slots=True)
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


def load_runtime_config() -> RuntimeConfig:
    raw = _load_toml(CONFIG_DIR / "runtime.toml")
    app = raw.get("app", {})
    database = raw.get("database", {})
    return RuntimeConfig(
        app=AppConfig(
            name=app.get("name", AppConfig.name),
            version=app.get("version", AppConfig.version),
        ),
        database=DatabaseConfig(
            dsn=database.get("dsn", DatabaseConfig.dsn),
            schema=database.get("schema", DatabaseConfig.schema),
        ),
    )


def load_apify_config() -> ApifyProviderConfig:
    raw = _load_toml(CONFIG_DIR / "providers" / "apify.toml")
    provider = raw.get("provider", {})
    return ApifyProviderConfig(
        name=provider.get("name", ApifyProviderConfig.name),
        enabled=bool(provider.get("enabled", ApifyProviderConfig.enabled)),
        token_env=provider.get("token_env", ApifyProviderConfig.token_env),
        actor_id=provider.get("actor_id", ApifyProviderConfig.actor_id),
        dataset_id=provider.get("dataset_id", ApifyProviderConfig.dataset_id),
        default_platform=provider.get("default_platform", ApifyProviderConfig.default_platform),
        docs_url=provider.get("docs_url", ApifyProviderConfig.docs_url),
        setup_steps=list(provider.get("setup_steps", [])),
    )
