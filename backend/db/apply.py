from __future__ import annotations

from backend.db.migrations import get_database_dsn, list_migration_files


def apply_migrations() -> list[str]:
    try:
        import psycopg
    except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "psycopg is required to apply migrations. Install backend dependencies first."
        ) from exc

    migration_files = list_migration_files()
    if not migration_files:
        return []

    dsn = get_database_dsn()
    applied: list[str] = []
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for migration_file in migration_files:
                cur.execute(migration_file.read_text(encoding="utf-8"))
                applied.append(migration_file.name)
        conn.commit()
    return applied


if __name__ == "__main__":
    applied_files = apply_migrations()
    print("Applied migrations:")
    for item in applied_files:
        print(f"- {item}")
