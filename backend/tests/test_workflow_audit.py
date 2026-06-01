from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Literal

from backend.db import audit, competitors, posts


class _FakeCursor:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row
        self.executed: list[tuple[str, tuple[Any, ...] | list[Any]]] = []

    def __enter__(self) -> _FakeCursor:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> Literal[False]:
        return False

    def execute(self, sql: str, params: tuple[Any, ...] | list[Any]) -> None:
        self.executed.append((sql, params))

    def fetchone(self) -> dict[str, Any]:
        return self._row


class _FakeConnection:
    def __init__(self, row: dict[str, Any]) -> None:
        self.cursor_obj = _FakeCursor(row)
        self.commit_count = 0

    def cursor(self, row_factory: object | None = None) -> _FakeCursor:
        return self.cursor_obj

    def commit(self) -> None:
        self.commit_count += 1


@contextmanager
def _fake_connection(row: dict[str, Any]) -> Iterator[_FakeConnection]:
    connection = _FakeConnection(row)
    yield connection


def test_record_run_emits_workflow_event(monkeypatch: Any) -> None:
    row: dict[str, Any] = {
        "id": "run-1",
        "run_type": "posts_analysis",
        "provider": "openai-compatible",
        "status": "completed",
        "input": {},
        "output": {},
        "error_message": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(competitors, "connection", lambda: _fake_connection(row))
    monkeypatch.setattr(
        competitors,
        "record_workflow_event",
        lambda **kwargs: recorded.setdefault("event", kwargs) or {"id": "event-1", **kwargs},
    )

    result = competitors.record_run(
        run_type="posts_analysis",
        provider="openai-compatible",
        status="completed",
        input_payload={"targets": ["competitor-1"]},
        output_payload={"post_ids": ["post-1"]},
        error_message=None,
        run_id="run-1",
    )

    assert result["id"] == "run-1"
    assert recorded["event"]["entity_type"] == "run"
    assert recorded["event"]["entity_id"] == "run-1"
    assert recorded["event"]["action"] == "record"
    assert recorded["event"]["outcome"] == "completed"
    assert recorded["event"]["provider"] == "openai-compatible"
    assert recorded["event"]["run_id"] == "run-1"
    assert recorded["event"]["payload"]["input"] == {"targets": ["competitor-1"]}
    assert recorded["event"]["payload"]["output"] == {"post_ids": ["post-1"]}


def test_record_workflow_event_inserts_audit_row(monkeypatch: Any) -> None:
    row: dict[str, Any] = {
        "id": "event-1",
        "actor": "system",
        "entity_type": "post",
        "entity_id": "post-1",
        "action": "reject",
        "outcome": "rejected",
        "provider": "openai-compatible",
        "run_id": "run-1",
        "source_run_id": "run-1",
        "payload": {"source_run_id": "run-1"},
        "created_at": "2026-01-01T00:00:00Z",
    }

    monkeypatch.setattr(audit, "connection", lambda: _fake_connection(row))

    result = audit.record_workflow_event(
        entity_type="post",
        entity_id="post-1",
        action="reject",
        outcome="rejected",
        provider="openai-compatible",
        run_id="run-1",
        source_run_id="run-1",
        payload={"source_run_id": "run-1"},
    )

    assert result["id"] == "event-1"
    assert result["entity_type"] == "post"
    assert result["outcome"] == "rejected"


def test_review_actions_record_workflow_events(monkeypatch: Any) -> None:
    cases = [
        (competitors, "approve_competitor", "competitor", "approved", True),
        (competitors, "reject_competitor", "competitor", "rejected", False),
        (posts, "approve_post", "post", "approved", True),
        (posts, "reject_post", "post", "rejected", True),
    ]

    for module, func_name, entity_type, outcome, should_record_event in cases:
        row: dict[str, Any] = {
            "id": "item-1",
            "approved": outcome == "approved",
            "rejected": outcome == "rejected",
            "source_run_id": "run-9",
        }
        captured: dict[str, Any] = {}

        monkeypatch.setattr(module, "connection", lambda row=row: _fake_connection(row))
        if should_record_event:
            monkeypatch.setattr(
                module,
                "record_workflow_event",
                lambda captured=captured, **kwargs: captured.setdefault("event", kwargs) or {"id": "event-1", **kwargs},
            )
        else:
            monkeypatch.setattr(
                module,
                "record_workflow_event",
                lambda **kwargs: (_ for _ in ()).throw(AssertionError("reject_competitor should not record workflow events")),
            )

        result = getattr(module, func_name)("item-1", source_run_id="run-9")

        assert result["id"] == "item-1"
        if should_record_event:
            assert captured["event"]["entity_type"] == entity_type
            assert captured["event"]["entity_id"] == "item-1"
            assert captured["event"]["action"] == func_name.split("_")[0]
            assert captured["event"]["outcome"] == outcome
            assert captured["event"]["source_run_id"] == "run-9"
            assert captured["event"]["payload"] == {"source_run_id": "run-9"}
