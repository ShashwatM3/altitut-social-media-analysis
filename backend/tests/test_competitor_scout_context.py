from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from backend.api import main


class _FakeScoutConnector:
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
        assert scout_input["focus_keywords"] == ["social media"]
        assert scout_input["notes"] == ["focus on UC Davis"]
        return SimpleNamespace(
            run_id="scout-run-1",
            raw_response={"candidates": []},
            candidates=[
                {
                    "id": "competitor-1",
                    "name": "Peer Company",
                    "website": "https://peer.example.com",
                    "social_links": {"instagram": "https://instagram.com/peercompany"},
                    "relevance_summary": "Matches Altitut's audience and workflow.",
                    "traction_summary": "Growing visibility in the same ecosystem.",
                },
                {
                    "id": "competitor-2",
                    "name": "Website Only Co",
                    "website": "https://website-only.example.com",
                    "social_links": {},
                    "relevance_summary": "No social presence.",
                    "traction_summary": "Should be filtered out.",
                },
            ],
        )


def test_competitor_scout_uses_overridden_altitut_context(monkeypatch: Any) -> None:
    fake_connector = _FakeScoutConnector()
    recorded: dict[str, Any] = {}
    custom_context = "Custom Altitut context for a workshop cohort."

    monkeypatch.setattr(main, "LlmConnector", lambda: fake_connector)
    monkeypatch.setattr(main, "ExaConnector", lambda: SimpleNamespace(status=lambda: SimpleNamespace(provider='exa', ready=False, status='setup_required', missing_requirements=['EXA_API_KEY'], next_steps=['Set EXA_API_KEY in your environment.'], docs_url='https://exa.ai/docs/reference/search', details={'mode': 'setup_required'}, to_dict=lambda: {'provider': 'exa', 'ready': False, 'status': 'setup_required', 'missing_requirements': ['EXA_API_KEY'], 'next_steps': ['Set EXA_API_KEY in your environment.'], 'docs_url': 'https://exa.ai/docs/reference/search', 'details': {'mode': 'setup_required'}})))
    monkeypatch.setattr(main, "list_competitors", lambda approved=True: [
        {
            "id": "approved-target",
            "name": "Approved Target",
            "website": "https://approved.example.com",
            "social_links": {"linkedin": "https://linkedin.com/company/approved-target"},
        }
    ] if approved else [])
    monkeypatch.setattr(main, "extract_social_links_from_website", lambda url: {})
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
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-2", **kwargs},
    )

    result = asyncio.run(
        main.competitor_scout(
            {
                "altitut_context": custom_context,
                "focus_keywords": ["social media"],
                "notes": ["focus on UC Davis"],
            }
        )
    )

    assert result["status"] == "completed"
    assert fake_connector.calls[0]["altitut_context"] == custom_context
    assert fake_connector.calls[0]["approved_companies"][0]["name"] == "Approved Target"
    assert recorded["run"]["input_payload"]["altitut_context"] == custom_context


def test_competitor_scout_uses_preloaded_altitut_context_and_filters_candidates(monkeypatch: Any) -> None:
    fake_connector = _FakeScoutConnector()
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(main, "LlmConnector", lambda: fake_connector)
    monkeypatch.setattr(main, "ExaConnector", lambda: SimpleNamespace(status=lambda: SimpleNamespace(provider='exa', ready=False, status='setup_required', missing_requirements=['EXA_API_KEY'], next_steps=['Set EXA_API_KEY in your environment.'], docs_url='https://exa.ai/docs/reference/search', details={'mode': 'setup_required'}, to_dict=lambda: {'provider': 'exa', 'ready': False, 'status': 'setup_required', 'missing_requirements': ['EXA_API_KEY'], 'next_steps': ['Set EXA_API_KEY in your environment.'], 'docs_url': 'https://exa.ai/docs/reference/search', 'details': {'mode': 'setup_required'}})))
    monkeypatch.setattr(main, "list_competitors", lambda approved=True: [
        {
            "id": "approved-target",
            "name": "Approved Target",
            "website": "https://approved.example.com",
            "social_links": {"linkedin": "https://linkedin.com/company/approved-target"},
        }
    ] if approved else [])
    monkeypatch.setattr(main, "extract_social_links_from_website", lambda url: {})
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

    result = asyncio.run(main.competitor_scout({"focus_keywords": ["social media"], "notes": ["focus on UC Davis"]}))

    assert result["status"] == "completed"
    assert result["candidate_count"] == 1
    assert result["candidates"][0]["id"] == "competitor-1"
    assert result["candidates"][0]["name"] == "Peer Company"
    assert result["candidates"][0]["source_run_id"] == recorded["run"]["run_id"]
    assert fake_connector.calls[0]["altitut_context"].startswith("Altitut")
    assert fake_connector.calls[0]["altitut_context"] == main.DEFAULT_ALTITUT_CONTEXT
    assert fake_connector.calls[0]["approved_companies"][0]["name"] == "Approved Target"
    assert recorded["run"]["provider"] == "multi-source"
    assert recorded["run"]["status"] == "completed"
    assert recorded["run"]["output_payload"]["candidate_count"] == 1
    assert recorded["run"]["input_payload"]["altitut_context"] == main.DEFAULT_ALTITUT_CONTEXT
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["social_links"] == {"instagram": "https://instagram.com/peercompany"}


def test_competitor_scout_keeps_all_social_candidates(monkeypatch: Any) -> None:
    class _SimilarityFilterConnector(_FakeScoutConnector):
        def scout_competitors(self, scout_input: dict[str, Any]) -> SimpleNamespace:
            self.calls.append(scout_input)
            return SimpleNamespace(
                run_id="scout-run-2",
                raw_response={"candidates": []},
                candidates=[
                    {
                        "id": "altitut-like",
                        "name": "LearnLaunch",
                        "website": "https://learnlaunch.example.com",
                        "social_links": {"linkedin": "https://linkedin.com/company/learnlaunch"},
                        "relevance_summary": (
                            "An entrepreneurial learning platform for founders to validate ideas, run customer discovery, "
                            "and practice pitches in one place."
                        ),
                        "traction_summary": "Early traction among student founders and startup cohorts.",
                    },
                    {
                        "id": "yc-like",
                        "name": "Y Combinator",
                        "website": "https://ycombinator.com",
                        "social_links": {"x": "https://x.com/ycombinator"},
                        "relevance_summary": (
                            "A startup accelerator that invests in early-stage companies and runs a batch program."
                        ),
                        "traction_summary": "Strong brand, large accelerator network, and investor recognition.",
                    },
                    {
                        "id": "fi-like",
                        "name": "Founder's Institute",
                        "website": "https://fi.co",
                        "social_links": {"instagram": "https://instagram.com/foundersinstitute"},
                        "relevance_summary": (
                            "A founder network and accelerator-style program focused on mentorship and ecosystem access."
                        ),
                        "traction_summary": "Programmatic founder community, not a product platform for learner workflows.",
                    },
                ],
            )

    fake_connector = _SimilarityFilterConnector()
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(main, "LlmConnector", lambda: fake_connector)
    monkeypatch.setattr(main, "ExaConnector", lambda: SimpleNamespace(status=lambda: SimpleNamespace(provider='exa', ready=False, status='setup_required', missing_requirements=['EXA_API_KEY'], next_steps=['Set EXA_API_KEY in your environment.'], docs_url='https://exa.ai/docs/reference/search', details={'mode': 'setup_required'}, to_dict=lambda: {'provider': 'exa', 'ready': False, 'status': 'setup_required', 'missing_requirements': ['EXA_API_KEY'], 'next_steps': ['Set EXA_API_KEY in your environment.'], 'docs_url': 'https://exa.ai/docs/reference/search', 'details': {'mode': 'setup_required'}})))
    monkeypatch.setattr(main, "extract_social_links_from_website", lambda url: {})
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
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-2", **kwargs},
    )

    result = asyncio.run(
        main.competitor_scout(
            {
                "altitut_context": main.DEFAULT_ALTITUT_CONTEXT,
                "focus_keywords": ["entrepreneurship platform", "customer discovery"],
                "notes": ["Only keep extremely similar product-platform competitors."],
            }
        )
    )

    assert result["status"] == "completed"
    assert result["candidate_count"] == 3
    assert [candidate["id"] for candidate in result["candidates"]] == ["altitut-like", "yc-like", "fi-like"]
    assert recorded["run"]["output_payload"]["candidate_ids"] == ["altitut-like", "yc-like", "fi-like"]
    assert recorded["run"]["output_payload"]["candidate_count"] == 3


def test_normalize_scout_candidate_coerces_social_links_string_and_list() -> None:
    string_candidate = main._normalize_scout_candidate(
        {
            "id": "string-link",
            "name": "String Link Co",
            "website": "https://string-link.example.com",
            "social_links": "https://instagram.com/stringlink",
            "relevance_summary": "A platform that matches Altitut's workflow.",
            "traction_summary": "Visible social presence.",
        },
        index=0,
    )
    list_candidate = main._normalize_scout_candidate(
        {
            "id": "list-link",
            "name": "List Link Co",
            "website": "https://list-link.example.com",
            "social_links": [
                "https://linkedin.com/company/listlink",
                "https://x.com/listlink",
            ],
            "relevance_summary": "A platform that matches Altitut's workflow.",
            "traction_summary": "Visible social presence.",
        },
        index=1,
    )

    assert string_candidate is not None
    assert string_candidate["social_links"] == {"instagram": "https://instagram.com/stringlink"}
    assert list_candidate is not None
    assert list_candidate["social_links"] == {
        "linkedin": "https://linkedin.com/company/listlink",
        "x": "https://x.com/listlink",
    }
