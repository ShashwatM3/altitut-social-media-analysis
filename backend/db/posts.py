from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg.rows import dict_row
from psycopg.types.json import Json

from backend.db.audit import record_workflow_event
from backend.db.client import connection


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _json_payload(value: dict[str, Any] | list[Any] | None) -> Json:
    return Json(value or {})


def save_post(
    post: dict[str, Any],
    approved: bool = False,
    source_run_id: str | None = None,
) -> dict[str, Any]:
    post_id = post.get("id") or f"post_{uuid4().hex}"
    now = _utcnow()
    approved_at = now if approved else None
    reviewed_at = now if approved else None
    rejected = bool(post.get("rejected", False))
    rejected_at = post.get("rejected_at") if isinstance(post.get("rejected_at"), datetime) else None
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO posts (
                    id,
                    competitor_id,
                    source_platform,
                    source_url,
                    retrieval_mode,
                    title,
                    caption,
                    transcript,
                    frames,
                    traction,
                    analysis,
                    approved,
                    approved_at,
                    rejected,
                    rejected_at,
                    reviewed_at,
                    source_run_id,
                    created_at,
                    updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    competitor_id = EXCLUDED.competitor_id,
                    source_platform = EXCLUDED.source_platform,
                    source_url = EXCLUDED.source_url,
                    retrieval_mode = EXCLUDED.retrieval_mode,
                    title = EXCLUDED.title,
                    caption = EXCLUDED.caption,
                    transcript = EXCLUDED.transcript,
                    frames = EXCLUDED.frames,
                    traction = EXCLUDED.traction,
                    analysis = EXCLUDED.analysis,
                    approved = posts.approved OR EXCLUDED.approved,
                    approved_at = COALESCE(posts.approved_at, EXCLUDED.approved_at),
                    rejected = posts.rejected OR EXCLUDED.rejected,
                    rejected_at = COALESCE(posts.rejected_at, EXCLUDED.rejected_at),
                    reviewed_at = COALESCE(posts.reviewed_at, EXCLUDED.reviewed_at),
                    source_run_id = COALESCE(EXCLUDED.source_run_id, posts.source_run_id),
                    updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    post_id,
                    post["competitor_id"],
                    post["source_platform"],
                    post.get("source_url"),
                    post["retrieval_mode"],
                    post.get("title"),
                    post.get("caption"),
                    post.get("transcript"),
                    Json(post.get("frames", [])),
                    Json(post.get("traction", {})),
                    Json(post.get("analysis", {})),
                    approved,
                    approved_at,
                    rejected,
                    rejected_at,
                    reviewed_at,
                    source_run_id,
                    now,
                    now,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:  # pragma: no cover - defensive guard
        raise RuntimeError("Failed to save post")
    return dict(row)


def approve_post(post_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    now = _utcnow()
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE posts
                SET approved = TRUE,
                    rejected = FALSE,
                    approved_at = %s,
                    reviewed_at = %s,
                    source_run_id = COALESCE(%s, source_run_id),
                    updated_at = %s
                WHERE id = %s
                RETURNING *
                """,
                (now, now, source_run_id, now, post_id),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:
        raise KeyError(f"Post not found: {post_id}")
    record_workflow_event(
        entity_type="post",
        entity_id=post_id,
        action="approve",
        outcome="approved",
        source_run_id=source_run_id,
        payload={"source_run_id": source_run_id},
    )
    return dict(row)


def reject_post(post_id: str, source_run_id: str | None = None) -> dict[str, Any]:
    now = _utcnow()
    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE posts
                SET approved = FALSE,
                    rejected = TRUE,
                    rejected_at = %s,
                    reviewed_at = %s,
                    source_run_id = COALESCE(%s, source_run_id),
                    updated_at = %s
                WHERE id = %s
                RETURNING *
                """,
                (now, now, source_run_id, now, post_id),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:
        raise KeyError(f"Post not found: {post_id}")
    record_workflow_event(
        entity_type="post",
        entity_id=post_id,
        action="reject",
        outcome="rejected",
        source_run_id=source_run_id,
        payload={"source_run_id": source_run_id},
    )
    return dict(row)


def list_posts(
    approved: bool | None = None,
    competitor_id: str | None = None,
) -> list[dict[str, Any]]:
    query = """
        SELECT
            posts.*,
            competitors.name AS competitor_name
        FROM posts
        LEFT JOIN competitors ON competitors.id = posts.competitor_id
    """
    params: list[Any] = []
    where_clauses: list[str] = []
    if approved is not None:
        where_clauses.append("posts.approved = %s")
        params.append(approved)
    if competitor_id is not None:
        where_clauses.append("posts.competitor_id = %s")
        params.append(competitor_id)
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
    query += " ORDER BY posts.created_at DESC, posts.title ASC NULLS LAST"
    query_sql: Any = query
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query_sql, params)
        rows = cur.fetchall()
    return [dict(row) for row in rows]
