from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from backend.api import main


class _FakeStatus:
    def __init__(self, ready: bool) -> None:
        self.provider = "apify"
        self.ready = ready
        self.status = "ready" if ready else "setup_required"
        self.missing_requirements = [] if ready else ["APIFY_TOKEN", "provider.actor_id"]
        self.next_steps: list[str] = []
        self.docs_url = "https://docs.apify.com/"
        self.details = {"config": {"actor_id": "apify/instagram-profile-scraper"}}

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "ready": self.ready,
            "status": self.status,
            "missing_requirements": self.missing_requirements,
            "next_steps": self.next_steps,
            "docs_url": self.docs_url,
            "details": self.details,
        }


class _FakeConnector:
    def __init__(self, ready: bool, execution: SimpleNamespace | None = None) -> None:
        self._status = _FakeStatus(ready)
        self._execution = execution

    def status(self) -> _FakeStatus:
        return self._status

    def setup_required(self) -> SimpleNamespace:
        return SimpleNamespace(to_dict=self._status.to_dict)

    def execute_competitor_scout(self, scout_input: dict[str, Any]) -> SimpleNamespace:
        assert scout_input["usernames"] == ["daviscurryclub", "ucdavis.startup", "sachacks"]
        assert scout_input["altitut_context"] == ""
        assert scout_input["focus_keywords"] == []
        assert scout_input["notes"] == []
        if self._execution is None:
            raise AssertionError("execution fixture missing")
        return self._execution


def test_validate_scout_request_accepts_profile_urls() -> None:
    payload = {
        "profile_urls": [
            "https://www.instagram.com/daviscurryclub/",
            "https://www.instagram.com/ucdavis.startup/",
            "https://www.instagram.com/sachacks/",
        ]
    }

    result = main._validate_scout_request(payload)

    assert result["usernames"] == ["daviscurryclub", "ucdavis.startup", "sachacks"]
    assert result["altitut_context"] == ""
    assert result["focus_keywords"] == []
    assert result["notes"] == []


def test_competitor_scout_returns_setup_required_when_apify_missing(monkeypatch: Any) -> None:
    fake_connector = _FakeConnector(ready=False)
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(main, "ApifyConnector", lambda: fake_connector)
    monkeypatch.setattr(
        main,
        "record_run",
        lambda **kwargs: recorded.setdefault("run", kwargs) or {"id": "run-1", **kwargs},
    )

    result = asyncio.run(
        main.competitor_scout({"profile_urls": ["https://www.instagram.com/daviscurryclub/"]})
    )

    assert result["status"] == "setup_required"
    assert recorded["run"]["status"] == "setup_required"
    assert recorded["run"]["input_payload"]["usernames"] == ["daviscurryclub"]


def test_competitor_scout_persists_candidates_when_apify_ready(monkeypatch: Any) -> None:
    execution = SimpleNamespace(
        run_id="run-123",
        dataset_id="dataset-123",
        raw_run={"id": "run-123", "status": "SUCCEEDED"},
        raw_items=[{"name": "candidate-one"}],
        candidates=[
            {
                "id": "competitor-candidate-one",
                "name": "Candidate One",
                "website": "https://example.com",
                "social_links": {},
                "relevance_summary": "Relevant",
                "traction_summary": "followersCount=1000",
                "source_run_id": "run-123",
            }
        ],
    )
    fake_connector = _FakeConnector(ready=True, execution=execution)
    recorded: dict[str, Any] = {}

    monkeypatch.setattr(main, "ApifyConnector", lambda: fake_connector)
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
                "profile_urls": [
                    "https://www.instagram.com/daviscurryclub/",
                    "https://www.instagram.com/ucdavis.startup/",
                    "https://www.instagram.com/sachacks/",
                ]
            }
        )
    )

    assert result["status"] == "completed"
    assert result["candidate_count"] == 1
    assert result["candidates"][0]["id"] == "competitor-candidate-one"
    assert recorded["run"]["status"] == "completed"
    assert recorded["run"]["run_id"] == "run-123"
