from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from backend.api import main
from backend.connectors import llm as llm_connector


class _RejectResult(dict[str, Any]):
    pass


def _llm_config(*, enabled: bool, api_key: str = "", model: str = "", offline_fallback: bool = True) -> Any:
    return SimpleNamespace(
        name="openai-compatible",
        enabled=enabled,
        api_key_env="OPENAI_API_KEY",
        api_key=api_key,
        base_url="https://api.openai.com/v1",
        model=model,
        docs_url="https://platform.openai.com/docs",
        setup_steps=[
            "Set OPENAI_API_KEY in your environment.",
            "Choose a compatible chat model and set provider.model.",
        ],
        timeout_seconds=60,
        offline_fallback=offline_fallback,
    )


def test_llm_status_returns_offline_ready_without_credentials() -> None:
    result = asyncio.run(main.llm_status())

    assert result["status"] == "ready"
    assert result["ready"] is True
    assert result["provider"] == "offline-heuristic"
    assert result["details"]["mode"] == "offline"
    assert result["missing_requirements"] == []


def test_llm_status_reports_setup_required_without_offline_fallback(monkeypatch: Any) -> None:
    monkeypatch.setattr(llm_connector, "load_llm_config", lambda: _llm_config(enabled=True, offline_fallback=False))

    result = asyncio.run(main.llm_status())

    assert result["status"] == "setup_required"
    assert result["ready"] is False
    assert result["provider"] == "openai-compatible"
    assert result["details"]["mode"] == "setup_required"
    assert result["missing_requirements"] == ["OPENAI_API_KEY", "provider.model"]


def test_llm_offline_fallback_analysis_uses_local_heuristics(monkeypatch: Any) -> None:
    monkeypatch.setattr(llm_connector, "load_llm_config", lambda: _llm_config(enabled=True, model="", api_key="", offline_fallback=True))

    analysis = llm_connector.LlmConnector().analyze_post(
        {
            "id": "post-1",
            "competitor_name": "Creator One",
            "source_platform": "instagram",
            "caption": "Hook-driven caption",
        },
        context={"retrieval_mode": "popular"},
    )

    assert analysis["provider"] == "offline-heuristic"
    assert analysis["model"] == "offline-heuristic-v1"
    assert analysis["status"] == "completed"
    assert "Creator One post analyzed for popular retrieval" in analysis["summary"]


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
