from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg.rows import dict_row
from psycopg.types.json import Json

from backend.db.client import connection


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _json_payload(value: dict[str, Any] | list[Any] | None) -> Json:
    return Json(value or {})


def record_run(
    run_type: str,
    provider: str,
    status: str,
    input_payload: dict[str, Any] | None = None,
    output_payload: dict[str, Any] | None = None,
    error_message: str | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    generated_id = run_id or f"run_{uuid4().hex}"
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO runs (
                    id,
                    run_type,
                    provider,
                    status,
                    input,
                    output,
                    error_message,
                    created_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    run_type = EXCLUDED.run_type,
                    provider = EXCLUDED.provider,
                    status = EXCLUDED.status,
                    input = EXCLUDED.input,
                    output = EXCLUDED.output,
                    error_message = EXCLUDED.error_message,
                    updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    generated_id,
                    run_type,
                    provider,
                    status,
                    _json_payload(input_payload),
                    _json_payload(output_payload),
                    error_message,
                    _utcnow(),
                    _utcnow(),
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:  # pragma: no cover - defensive guard
        raise RuntimeError("Failed to record run")
    return dict(row)


def save_competitor(candidate: dict[str, Any], approved: bool = False, source_run_id: str | None = None) -> dict[str, Any]:
    competitor_id = candidate["id"]
    approved_at = _utcnow() if approved else None
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO competitors (
                    id,
                    name,
                    website,
                    social_links,
                    relevance_summary,
                    traction_summary,
                    approved,
                    approved_at,
                    source_run_id,
                    created_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    website = EXCLUDED.website,
                    social_links = EXCLUDED.social_links,
                    relevance_summary = EXCLUDED.relevance_summary,
                    traction_summary = EXCLUDED.traction_summary,
                    approved = competitors.approved OR EXCLUDED.approved,
                    approved_at = COALESCE(competitors.approved_at, EXCLUDED.approved_at),
                    source_run_id = COALESCE(EXCLUDED.source_run_id, competitors.source_run_id),
                    updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    competitor_id,
                    candidate["name"],
                    candidate.get("website"),
                    Json(candidate.get("social_links", {})),
                    candidate["relevance_summary"],
                    candidate["traction_summary"],
                    approved,
                    approved_at,
                    source_run_id,
                    _utcnow(),
                    _utcnow(),
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:  # pragma: no cover - defensive guard
        raise RuntimeError("Failed to save competitor")
    return dict(row)


def approve_competitor(competitor_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    approved_at = _utcnow()
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE competitors
                SET approved = TRUE,
                    approved_at = %s,
                    source_run_id = COALESCE(%s, source_run_id),
                    updated_at = %s
                WHERE id = %s
                RETURNING *
                """,
                (approved_at, source_run_id, _utcnow(), competitor_id),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:
        raise KeyError(f"Competitor not found: {competitor_id}")
    return dict(row)


def list_competitors(approved: bool | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM competitors"
    params: list[Any] = []
    if approved is not None:
        query += " WHERE approved = %s"
        params.append(approved)
    query += " ORDER BY created_at DESC, name ASC"
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    return [dict(row) for row in rows]
