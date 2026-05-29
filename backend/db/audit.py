from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg.rows import dict_row
from psycopg.types.json import Json

from backend.db.client import connection

WORKFLOW_ACTOR = "system"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _json_payload(value: dict[str, Any] | list[Any] | None) -> Json:
    return Json(value or {})


def record_workflow_event(
    *,
    actor: str = WORKFLOW_ACTOR,
    entity_type: str,
    entity_id: str,
    action: str,
    outcome: str,
    provider: str | None = None,
    run_id: str | None = None,
    source_run_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    event_id = f"event_{uuid4().hex}"
    now = _utcnow()
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO workflow_events (
                    id,
                    actor,
                    entity_type,
                    entity_id,
                    action,
                    outcome,
                    provider,
                    run_id,
                    source_run_id,
                    payload,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    event_id,
                    actor,
                    entity_type,
                    entity_id,
                    action,
                    outcome,
                    provider,
                    run_id,
                    source_run_id,
                    _json_payload(payload),
                    now,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:  # pragma: no cover - defensive guard
        raise RuntimeError("Failed to record workflow event")
    return dict(row)
