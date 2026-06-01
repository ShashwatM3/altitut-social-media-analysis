from __future__ import annotations

import ast
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


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        value = raw_value.strip()
        if value.startswith(("'", '"')) and len(value) >= 2 and value[-1] == value[0]:
            try:
                parsed = ast.literal_eval(value)
            except (SyntaxError, ValueError):
                parsed = value[1:-1]
            value = str(parsed)
        os.environ.setdefault(key, value)


def _load_repo_environment() -> None:
    for env_path in (ROOT_DIR / ".env", ROOT_DIR / ".env.local"):
        _load_env_file(env_path)


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

    @property
    def api_key(self) -> str:
        return _env(self.api_key_env)


@dataclass
class ExaProviderConfig:
    name: str = "exa"
    enabled: bool = True
    api_key_env: str = "EXA_API_KEY"
    base_url: str = "https://api.exa.ai"
    docs_url: str = "https://exa.ai/docs/reference/search"
    setup_steps: list[str] = field(default_factory=list)
    timeout_seconds: int = 60

    @property
    def api_key(self) -> str:
        return _env(self.api_key_env)


def load_runtime_config() -> RuntimeConfig:
    _load_repo_environment()
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
    _load_repo_environment()
    raw = _load_toml(CONFIG_DIR / "providers" / "apify.toml")
    provider = raw.get("provider", {})
    return ApifyProviderConfig(
        name=provider.get("name", "apify"),
        enabled=bool(provider.get("enabled", True)),
        token_env=provider.get("token_env", "APIFY_TOKEN"),
        actor_id=_env("APIFY_ACTOR_ID", provider.get("actor_id", "")),
        dataset_id=_env("APIFY_DATASET_ID", provider.get("dataset_id", "")),
        default_platform=_env("APIFY_DEFAULT_PLATFORM", provider.get("default_platform", "instagram")),
        docs_url=provider.get("docs_url", "https://docs.apify.com/"),
        setup_steps=list(provider.get("setup_steps", [])),
    )


def load_llm_config() -> LlmProviderConfig:
    _load_repo_environment()
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
        base_url=_env("OPENAI_BASE_URL", provider.get("base_url", "https://api.openai.com/v1")),
        model=_env("OPENAI_MODEL", provider.get("model", "")),
        docs_url=provider.get("docs_url", "https://platform.openai.com/docs"),
        setup_steps=list(provider.get("setup_steps", [])),
        timeout_seconds=timeout_value,
    )


def load_exa_config() -> ExaProviderConfig:
    _load_repo_environment()
    raw = _load_toml(CONFIG_DIR / "providers" / "exa.toml")
    provider = raw.get("provider", {})
    timeout_seconds = provider.get("timeout_seconds", 60)
    try:
        timeout_value = max(1, int(timeout_seconds))
    except (TypeError, ValueError):
        timeout_value = 60
    return ExaProviderConfig(
        name=provider.get("name", "exa"),
        enabled=bool(provider.get("enabled", True)),
        api_key_env=provider.get("api_key_env", "EXA_API_KEY"),
        base_url=_env("EXA_BASE_URL", provider.get("base_url", "https://api.exa.ai")),
        docs_url=provider.get("docs_url", "https://exa.ai/docs/reference/search"),
        setup_steps=list(provider.get("setup_steps", [])),
        timeout_seconds=timeout_value,
    )
