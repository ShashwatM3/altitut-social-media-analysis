from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row

from backend.db.client import connection


def refactor_database_records() -> dict[str, Any]:
    table_names = ["workflow_events", "runs", "posts", "competitors"]
    deleted_counts: dict[str, int] = {}

    with connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            for table_name in table_names:
                query_sql: Any = f'SELECT COUNT(*) AS count FROM {table_name}'
                cur.execute(query_sql)
                row = cur.fetchone()
                deleted_counts[table_name] = int(row["count"]) if row else 0

            truncate_sql: Any = "TRUNCATE TABLE workflow_events, runs, posts, competitors RESTART IDENTITY CASCADE"
            cur.execute(truncate_sql)
        conn.commit()

    return {
        "status": "completed",
        "deleted_counts": deleted_counts,
    }