from __future__ import annotations

import os
from pathlib import Path

from backend.settings import ROOT_DIR, load_runtime_config

MIGRATIONS_DIR = ROOT_DIR / "backend" / "migrations"


def list_migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def get_database_dsn() -> str:
    return os.getenv("DATABASE_URL", load_runtime_config().database.dsn)


def render_migration_plan() -> str:
    files = list_migration_files()
    if not files:
        return "No SQL migrations found."
    return "\n".join(f"- {path.name}" for path in files)
