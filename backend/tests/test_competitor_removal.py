from __future__ import annotations

from typing import Any

from backend.db import competitors as competitors_db


class _FakeCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._row = {
            'id': 'dismiss-me',
            'name': 'Dismiss Me',
            'website': 'https://dismiss.example.com',
            'social_links': {'linkedin': 'https://linkedin.com/company/dismiss-me'},
            'relevance_summary': 'Relevant competitor',
            'traction_summary': 'Consistent traction',
            'approved': False,
            'rejected': False,
        }

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        self.executed.append((sql.strip(), params))
        if sql.lstrip().upper().startswith('SELECT'):
            return
        self._row = None

    def fetchone(self) -> dict[str, Any] | None:
        row = self._row
        self._row = None
        return row


class _FakeCursorContext:
    def __init__(self, cursor: _FakeCursor) -> None:
        self.cursor = cursor

    def __enter__(self) -> _FakeCursor:
        return self.cursor

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeConnection:
    def __init__(self) -> None:
        self.cursor_obj = _FakeCursor()
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _FakeConnection:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def cursor(self, row_factory=None) -> _FakeCursorContext:
        return _FakeCursorContext(self.cursor_obj)

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


def test_reject_competitor_deletes_company_and_related_records(monkeypatch: Any) -> None:
    fake_connection = _FakeConnection()
    monkeypatch.setattr(competitors_db, 'connection', lambda: fake_connection)
    monkeypatch.setattr(competitors_db, 'record_workflow_event', lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError('record_workflow_event should not be called')))

    deleted = competitors_db.reject_competitor('dismiss-me')

    assert deleted['id'] == 'dismiss-me'
    assert fake_connection.committed is True
    executed_sql = [sql for sql, _ in fake_connection.cursor_obj.executed]
    assert any(sql.startswith('SELECT * FROM competitors WHERE id = %s') for sql in executed_sql)
    assert any(sql.startswith('DELETE FROM posts WHERE competitor_id = %s') for sql in executed_sql)
    assert any(sql.startswith('DELETE FROM workflow_events WHERE entity_type = %s AND entity_id = %s') for sql in executed_sql)
    assert any(sql.startswith('DELETE FROM competitors WHERE id = %s') for sql in executed_sql)
