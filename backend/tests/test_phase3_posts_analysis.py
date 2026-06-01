from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from backend.api import main
from backend.connectors import llm as llm_connector


class _FakeConnector:
    def __init__(self, ready: bool, execution: SimpleNamespace | None = None) -> None:
        self._ready = ready
        self._execution = execution

    def status(self) -> SimpleNamespace:
        return SimpleNamespace(
            provider="apify",
            ready=self._ready,
            status="ready" if self._ready else "setup_required",
            missing_requirements=[] if self._ready else ["APIFY_TOKEN", "provider.actor_id"],
            next_steps=[],
            docs_url="https://docs.apify.com/",
            details={"config": {"actor_id": "apify/instagram-profile-scraper"}},
            to_dict=lambda: {
                "provider": "apify",
                "ready": self._ready,
                "status": "ready" if self._ready else "setup_required",
                "missing_requirements": [] if self._ready else ["APIFY_TOKEN", "provider.actor_id"],
                "next_steps": [],
                "docs_url": "https://docs.apify.com/",
                "details": {"config": {"actor_id": "apify/instagram-profile-scraper"}},
            },
        )

    def setup_required(self) -> SimpleNamespace:
        return SimpleNamespace(
            to_dict=lambda: {
                "provider": "apify",
                "ready": False,
                "status": "setup_required",
                "missing_requirements": ["APIFY_TOKEN", "provider.actor_id"],
                "next_steps": [],
                "docs_url": "https://docs.apify.com/",
                "details": {"config": {"actor_id": "apify/instagram-profile-scraper"}},
            }
        )

    def execute_posts_analysis(self, analysis_input: dict[str, Any]) -> SimpleNamespace:
        assert analysis_input["retrieval_mode"] in {"recent", "popular"}
        assert analysis_input["post_limit"] == 4
        assert analysis_input["targets"]
        if self._execution is None:
            raise AssertionError("execution fixture missing")
        return self._execution


class _FakeLlmConnector:
    def __init__(self, ready: bool = True) -> None:
        self._ready = ready

    def status(self) -> SimpleNamespace:
        return SimpleNamespace(
            provider="openai-compatible",
            ready=self._ready,
            status="ready" if self._ready else "setup_required",
            missing_requirements=[] if self._ready else ["OPENAI_API_KEY", "provider.model"],
            next_steps=[],
            docs_url="https://platform.openai.com/docs",
            details={"config": {"model": "gpt-4.1-mini"}},
            to_dict=lambda: {
                "provider": "openai-compatible",
                "ready": self._ready,
                "status": "ready" if self._ready else "setup_required",
                "missing_requirements": [] if self._ready else ["OPENAI_API_KEY", "provider.model"],
                "next_steps": [],
                "docs_url": "https://platform.openai.com/docs",
                "details": {"config": {"model": "gpt-4.1-mini"}},
            },
        )

    def analyze_post(self, post: dict[str, Any], *, context: dict[str, Any] | None = None) -> dict[str, Any]:
        assert context is not None
        return {
            "summary": "LLM summary",
            "why_it_worked": ["Hook was clear"],
            "design_pattern": ["Strong visual"],
            "altitut_adaptation": ["Try the same opening"],
            "reasoning": "This post performed well because it had a strong hook.",
            "confidence": 0.91,
            "provider": "openai-compatible",
            "model": "gpt-4.1-mini",
        }


def test_resolve_posts_analysis_request_uses_approved_competitors_only(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        main,
        "list_competitors",
        lambda approved=True: [
            {
                "id": "competitor-1",
                "name": "Creator One",
                "social_links": {"instagram": "https://instagram.com/creator.one"},
            }
        ],
    )

    analysis_input, missing, next_steps = main._resolve_posts_analysis_request(
        {"competitor_ids": ["competitor-1"], "retrieval_mode": "popular"}
    )

    assert missing == []
    assert next_steps == []
    assert analysis_input["retrieval_mode"] == "popular"
    assert analysis_input["post_limit"] == 6
    assert analysis_input["targets"][0]["competitor_id"] == "competitor-1"
    assert analysis_input["targets"][0]["competitor_name"] == "Creator One"
    assert analysis_input["targets"][0]["usernames"] == ["creator.one"]


def test_resolve_posts_analysis_request_rejects_direct_usernames(monkeypatch: Any) -> None:
    monkeypatch.setattr(main, "list_competitors", lambda approved=True: [])

    with pytest.raises(main.HTTPException) as exc_info:
        main._resolve_posts_analysis_request({"usernames": ["creator.one"], "retrieval_mode": "recent"})

    assert exc_info.value.status_code == 422
    assert "approved competitor_ids" in exc_info.value.detail.lower()


def test_posts_analysis_persists_analyzed_posts(monkeypatch: Any) -> None:
    execution = SimpleNamespace(
        run_ids=["run-123"],
        dataset_ids=["dataset-123"],
        raw_runs=[{"id": "run-123", "status": "SUCCEEDED"}],
        raw_items=[{"latestPosts": [{"id": "post-1", "caption": "Caption", "likesCount": 99}]}],
        posts=[
            {
                "id": "post-competitor-1-post-1",
                "competitor_id": "competitor-1",
                "competitor_name": "Creator One",
                "source_platform": "instagram",
                "source_url": "https://instagram.com/p/post-1",
                "retrieval_mode": "recent",
                "title": "Caption",
                "caption": "Caption",
                "transcript": "",
                "frames": [],
                "traction": {"likesCount": 99},
                "analysis": {"summary": "ok"},
                "source_run_id": "run-123",
            }
        ],
    )
    fake_connector = _FakeConnector(ready=True, execution=execution)
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(
        main,
        "list_competitors",
        lambda approved=None: [
            {
                "id": "competitor-1",
                "name": "Creator One",
                "website": "https://www.instagram.com/creator.one/",
            }
        ],
    )
    monkeypatch.setattr(main, "ApifyConnector", lambda: fake_connector)
    monkeypatch.setattr(main, "LlmConnector", lambda: _FakeLlmConnector(ready=True))
    monkeypatch.setattr(
        main,
        "save_post",
        lambda post, approved=False, source_run_id=None: {
            **post,
            "approved": approved,
            "source_run_id": source_run_id,
        },
    )
    monkeypatch.setattr(
        main,
        "record_run",
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-2", **kwargs},
    )

    result = asyncio.run(
        main.posts_analysis({"competitor_ids": ["competitor-1"], "retrieval_mode": "recent", "post_limit": 4})
    )

    assert result["status"] == "completed"
    assert result["post_count"] == 1
    assert result["posts"][0]["competitor_name"] == "Creator One"
    assert result["posts"][0]["analysis"]["summary"] == "LLM summary"
    assert recorded["run"]["status"] == "completed"
    assert recorded["run"]["output_payload"]["post_ids"] == ["post-competitor-1-post-1"]


def test_posts_analysis_returns_setup_required_when_llm_needs_setup(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        main,
        "list_competitors",
        lambda approved=True: [
            {
                "id": "competitor-1",
                "name": "Creator One",
                "website": "https://www.instagram.com/creator.one/",
            }
        ],
    )
    monkeypatch.setattr(main, "ApifyConnector", lambda: _FakeConnector(ready=True, execution=None))
    monkeypatch.setattr(main, "LlmConnector", lambda: _FakeLlmConnector(ready=False))
    recorded: dict[str, Any] = {}
    monkeypatch.setattr(
        main,
        "record_run",
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-3", **kwargs},
    )

    result = asyncio.run(main.posts_analysis({"competitor_ids": ["competitor-1"]}))

    assert result["status"] == "setup_required"
    assert result["integration"]["provider"] == "openai-compatible"
    assert result["integration"]["status"] == "setup_required"
    assert recorded["run"]["provider"] == "openai-compatible"
    assert recorded["run"]["status"] == "setup_required"


def test_posts_analysis_uses_remote_llm_and_persists_posts(monkeypatch: Any) -> None:
    execution = SimpleNamespace(
        run_ids=["run-456"],
        dataset_ids=["dataset-456"],
        raw_runs=[{"id": "run-456", "status": "SUCCEEDED"}],
        raw_items=[{"latestPosts": [{"id": "post-1", "caption": "Caption", "likesCount": 99}]}],
        posts=[
            {
                "id": "post-competitor-1-post-1",
                "competitor_id": "competitor-1",
                "competitor_name": "Creator One",
                "source_platform": "instagram",
                "source_url": "https://instagram.com/p/post-1",
                "retrieval_mode": "popular",
                "title": "Caption",
                "caption": "Caption",
                "transcript": "",
                "frames": [],
                "traction": {"likesCount": 99},
                "analysis": {"summary": "remote"},
                "source_run_id": "run-456",
            }
        ],
    )
    fake_connector = _FakeConnector(ready=True, execution=execution)
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(
        main,
        "list_competitors",
        lambda approved=None: [
            {
                "id": "competitor-1",
                "name": "Creator One",
                "website": "https://www.instagram.com/creator.one/",
            }
        ],
    )
    monkeypatch.setattr(main, "ApifyConnector", lambda: fake_connector)
    monkeypatch.setattr(main, "LlmConnector", lambda: _FakeLlmConnector(ready=True))
    monkeypatch.setattr(
        main,
        "save_post",
        lambda post, approved=False, source_run_id=None: {
            **post,
            "approved": approved,
            "source_run_id": source_run_id,
        },
    )
    monkeypatch.setattr(
        main,
        "record_run",
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-4", **kwargs},
    )

    result = asyncio.run(
        main.posts_analysis({"competitor_ids": ["competitor-1"], "retrieval_mode": "popular", "post_limit": 4})
    )

    assert result["status"] == "completed"
    assert result["llm_integration"]["provider"] == "openai-compatible"
    assert result["posts"][0]["analysis"]["provider"] == "openai-compatible"
    assert result["posts"][0]["analysis"]["model"] == "gpt-4.1-mini"
    assert recorded["run"]["provider"] == "openai-compatible"
    assert recorded["run"]["output_payload"]["llm"]["provider"] == "openai-compatible"
