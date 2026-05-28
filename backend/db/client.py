from __future__ import annotations

from contextlib import contextmanager
from collections.abc import Iterator

import psycopg

from backend.db.migrations import get_database_dsn


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    with psycopg.connect(get_database_dsn()) as conn:
        yield conn
