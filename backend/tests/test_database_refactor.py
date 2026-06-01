from __future__ import annotations

import asyncio
from typing import Any

from backend.api import main


def test_refactor_database_route_delegates_to_maintenance_helper(monkeypatch: Any) -> None:
    captured: dict[str, Any] = {}
    expected_result = {
        "status": "completed",
        "deleted_counts": {
            "workflow_events": 4,
            "runs": 3,
            "posts": 2,
            "competitors": 1,
        },
    }

    monkeypatch.setattr(
        main,
        "refactor_database_records",
        lambda: (captured.setdefault("called", True), expected_result)[1],
    )

    result = asyncio.run(main.refactor_database())

    assert captured["called"] is True
    assert result["status"] == "completed"
    assert result["deleted_counts"] == {
        "workflow_events": 4,
        "runs": 3,
        "posts": 2,
        "competitors": 1,
    }
