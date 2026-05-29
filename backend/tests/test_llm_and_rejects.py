from __future__ import annotations

import asyncio
from typing import Any

from backend.api import main


class _RejectResult(dict[str, Any]):
    pass


def test_llm_status_returns_offline_ready_without_credentials() -> None:
    result = asyncio.run(main.llm_status())

    assert result["status"] == "ready"
    assert result["ready"] is True
    assert result["provider"] == "offline-heuristic"
    assert result["details"]["mode"] == "offline"
    assert result["missing_requirements"] == []


def test_reject_routes_delegate_to_db_helpers(monkeypatch: Any) -> None:
    competitor_called: dict[str, Any] = {}
    post_called: dict[str, Any] = {}

    monkeypatch.setattr(
        main,
        "reject_competitor",
        lambda competitor_id, source_run_id=None: competitor_called.setdefault(
            "result",
            _RejectResult(
                {
                    "id": competitor_id,
                    "rejected": True,
                    "source_run_id": source_run_id,
                }
            ),
        ),
    )
    monkeypatch.setattr(
        main,
        "reject_post",
        lambda post_id, source_run_id=None: post_called.setdefault(
            "result",
            _RejectResult(
                {
                    "id": post_id,
                    "rejected": True,
                    "source_run_id": source_run_id,
                }
            ),
        ),
    )

    competitor_result = asyncio.run(main.reject_competitor_route("competitor-1", source_run_id="run-1"))
    post_result = asyncio.run(main.reject_post_route("post-1", source_run_id="run-2"))

    assert competitor_result["id"] == "competitor-1"
    assert competitor_result["rejected"] is True
    assert competitor_result["source_run_id"] == "run-1"
    assert post_result["id"] == "post-1"
    assert post_result["rejected"] is True
    assert post_result["source_run_id"] == "run-2"
