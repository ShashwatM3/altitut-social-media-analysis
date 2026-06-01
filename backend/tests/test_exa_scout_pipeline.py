from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

from backend.api import main
from backend.connectors import exa as exa_connector


class _FakeExaConnector:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def status(self) -> SimpleNamespace:
        return SimpleNamespace(
            provider="exa",
            ready=True,
            status="ready",
            missing_requirements=[],
            next_steps=[],
            docs_url="https://exa.ai/docs/reference/search",
            details={"config": {"model": "deep"}, "mode": "remote"},
            to_dict=lambda: {
                "provider": "exa",
                "ready": True,
                "status": "ready",
                "missing_requirements": [],
                "next_steps": [],
                "docs_url": "https://exa.ai/docs/reference/search",
                "details": {"config": {"model": "deep"}, "mode": "remote"},
            },
        )

    def scout_competitors(self, scout_input: dict[str, Any]) -> SimpleNamespace:
        self.calls.append(scout_input)
        return SimpleNamespace(
            run_id="exa-run-1",
            raw_response={"results": []},
            candidates=[
                {
                    "id": "learnlaunch",
                    "name": "LearnLaunch",
                    "website": "https://learnlaunch.example.com",
                    "social_links": {},
                    "relevance_summary": "A platform-like learning workflow for founders.",
                    "traction_summary": "Visible public product and market presence.",
                }
            ],
        )


class _FakeLlmConnector:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def status(self) -> SimpleNamespace:
        return SimpleNamespace(
            provider="openai-compatible",
            ready=True,
            status="ready",
            missing_requirements=[],
            next_steps=[],
            docs_url="https://platform.openai.com/docs",
            details={"config": {"model": "gpt-4o-mini"}, "mode": "remote"},
            to_dict=lambda: {
                "provider": "openai-compatible",
                "ready": True,
                "status": "ready",
                "missing_requirements": [],
                "next_steps": [],
                "docs_url": "https://platform.openai.com/docs",
                "details": {"config": {"model": "gpt-4o-mini"}, "mode": "remote"},
            },
        )

    def scout_competitors(self, scout_input: dict[str, Any]) -> SimpleNamespace:
        self.calls.append(scout_input)
        return SimpleNamespace(
            run_id="llm-run-1",
            raw_response={"output_text": "{}"},
            candidates=[
                {
                    "id": "learnlaunch",
                    "name": "LearnLaunch",
                    "website": "https://learnlaunch.example.com",
                    "social_links": {"linkedin": "https://linkedin.com/company/learnlaunch"},
                    "relevance_summary": "A platform-like learning workflow for founders.",
                    "traction_summary": "Visible public product and market presence.",
                }
            ],
        )


def test_competitor_scout_merges_exa_and_llm_candidates_and_keeps_social_links(monkeypatch: Any) -> None:
    fake_exa = _FakeExaConnector()
    fake_llm = _FakeLlmConnector()
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(main, "ExaConnector", lambda: fake_exa)
    monkeypatch.setattr(main, "LlmConnector", lambda: fake_llm)
    monkeypatch.setattr(
        main,
        "save_competitor",
        lambda candidate, approved=False, source_run_id=None: {
            **candidate,
            "approved": approved,
            "source_run_id": source_run_id,
        },
    )
    monkeypatch.setattr(
        main,
        "record_run",
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-1", **kwargs},
    )

    result = asyncio.run(
        main.competitor_scout(
            {
                "altitut_context": main.DEFAULT_ALTITUT_CONTEXT,
                "focus_keywords": ["customer discovery", "pitch practice"],
                "notes": ["Prefer platform competitors with live web evidence."],
            }
        )
    )

    assert result["status"] == "completed"
    assert result["candidate_count"] == 1
    assert result["candidates"][0]["id"] == "learnlaunch"
    assert result["candidates"][0]["social_links"] == {
        "linkedin": "https://linkedin.com/company/learnlaunch"
    }
    assert fake_exa.calls[0]["altitut_context"] == main.DEFAULT_ALTITUT_CONTEXT
    assert fake_llm.calls[0]["altitut_context"] == main.DEFAULT_ALTITUT_CONTEXT
    assert recorded["run"]["output_payload"]["candidate_ids"] == ["learnlaunch"]
    assert recorded["run"]["output_payload"]["source_statuses"]["exa"]["provider"] == "exa"
    assert recorded["run"]["output_payload"]["source_statuses"]["llm"]["provider"] == "openai-compatible"


def test_exa_scout_request_uses_deep_company_search_and_queries(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        exa_connector,
        "load_exa_config",
        lambda: SimpleNamespace(
            name="exa",
            enabled=True,
            api_key_env="EXA_API_KEY",
            api_key="exa-test",
            base_url="https://api.exa.ai",
            docs_url="https://exa.ai/docs/reference/search",
            setup_steps=["Set EXA_API_KEY in your environment."],
            timeout_seconds=60,
        ),
    )

    captured: dict[str, Any] = {}

    def transport(method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: int) -> tuple[int, str]:
        captured["method"] = method
        captured["url"] = url
        captured["headers"] = headers
        captured["body"] = json.loads((body or b"{}").decode("utf-8"))
        return (
            200,
            json.dumps(
                {
                    "results": [
                        {
                            "title": "LearnLaunch",
                            "url": "https://learnlaunch.example.com",
                            "text": "A platform for founders to learn, validate, and practice pitches.",
                        }
                    ]
                }
            ),
        )

    execution = exa_connector.ExaConnector(transport=transport).scout_competitors(
        {
            "altitut_context": main.DEFAULT_ALTITUT_CONTEXT,
            "focus_keywords": ["customer discovery", "pitch practice"],
            "notes": ["Prefer platform-like competitors."],
            "approved_companies": [
                {
                    "id": "memory-target",
                    "name": "Memory Target",
                    "website": "https://memory.example.com",
                    "social_links": {"linkedin": "https://linkedin.com/company/memory-target"},
                }
            ],
        }
    )

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/search")
    assert captured["body"]["type"] == "deep"
    assert captured["body"]["category"] == "company"
    assert captured["body"]["numResults"] >= 10
    assert len(captured["body"]["additionalQueries"]) >= 2
    assert "at least 10 candidates" in captured["body"]["systemPrompt"]
    assert "approved_companies" in json.dumps(captured["body"]["queryContext"])
    assert "social_links" in json.dumps(captured["body"]["outputSchema"])
    assert execution.candidates[0]["name"] == "LearnLaunch"


def test_exa_scout_enriches_social_links_from_website(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        exa_connector,
        "load_exa_config",
        lambda: SimpleNamespace(
            name="exa",
            enabled=True,
            api_key_env="EXA_API_KEY",
            api_key="exa-test",
            base_url="https://api.exa.ai",
            docs_url="https://exa.ai/docs/reference/search",
            setup_steps=["Set EXA_API_KEY in your environment."],
            timeout_seconds=60,
        ),
    )

    monkeypatch.setattr(exa_connector, "_extract_social_links_from_website", lambda url: {"linkedin": "https://linkedin.com/company/learnlaunch"})

    def transport(method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: int) -> tuple[int, str]:
        return (
            200,
            json.dumps(
                {
                    "results": [
                        {
                            "title": "LearnLaunch",
                            "url": "https://learnlaunch.example.com",
                            "text": "A platform for founders to learn, validate, and practice pitches.",
                        }
                    ]
                }
            ),
        )

    execution = exa_connector.ExaConnector(transport=transport).scout_competitors(
        {
            "altitut_context": main.DEFAULT_ALTITUT_CONTEXT,
            "focus_keywords": ["customer discovery", "pitch practice"],
            "notes": ["Prefer platform-like competitors."],
        }
    )

    assert execution.candidates[0]["social_links"] == {"linkedin": "https://linkedin.com/company/learnlaunch"}
