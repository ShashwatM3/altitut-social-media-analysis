from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

from backend.api import main
from backend.connectors import llm as llm_connector


class _RejectResult(dict[str, Any]):
    pass


def _llm_config(*, enabled: bool, api_key: str = "", model: str = "") -> Any:
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
    )


def test_llm_status_returns_setup_required_without_credentials(monkeypatch: Any) -> None:
    monkeypatch.setattr(llm_connector, "load_llm_config", lambda: _llm_config(enabled=True))

    result = asyncio.run(main.llm_status())

    assert result["status"] == "setup_required"
    assert result["ready"] is False
    assert result["provider"] == "openai-compatible"
    assert result["details"]["mode"] == "setup_required"
    assert result["missing_requirements"] == ["OPENAI_API_KEY", "provider.model"]


def test_llm_status_flags_malformed_api_key(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        llm_connector,
        "load_llm_config",
        lambda: _llm_config(enabled=True, api_key="OPENAI_API_KEY=sk-test", model="gpt-4.1-mini"),
    )

    result = asyncio.run(main.llm_status())

    assert result["status"] == "setup_required"
    assert result["ready"] is False
    assert result["missing_requirements"] == ["OPENAI_API_KEY"]
    assert result["details"]["api_key_issue"] == "api_key_value_includes_env_var_name"
    assert any("secret value only" in step for step in result["next_steps"])


def test_llm_scout_prompt_hardens_similarity_filter(monkeypatch: Any) -> None:
    monkeypatch.setattr(llm_connector, "load_llm_config", lambda: _llm_config(enabled=True, api_key="sk-test", model="gpt-4.1-mini"))

    captured: dict[str, Any] = {}

    def transport(method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: int) -> tuple[int, str]:
        captured["method"] = method
        captured["url"] = url
        captured["body"] = json.loads((body or b"{}").decode("utf-8"))
        instructions = captured["body"].get("instructions", "")
        scout_input = json.loads(captured["body"].get("input", "{}"))
        assert "Return at least 10 candidates" in instructions
        assert "exact or extremely similar" in instructions
        assert "not a single one" in instructions or "approved companies" in instructions
        assert "approved_companies" in scout_input
        assert scout_input["approved_companies"][0]["name"] == "Memory Target"
        assert any(tool.get("type") == "web_search" for tool in captured["body"].get("tools", []))
        assert captured["body"].get("tool_choice") == "required"
        return (
            200,
            json.dumps(
                {
                    "output_text": json.dumps(
                        {
                            "candidates": [
                                {
                                    "id": "altitut-like",
                                    "name": "LearnLaunch",
                                    "website": "https://learnlaunch.example.com",
                                    "social_links": {"linkedin": "https://linkedin.com/company/learnlaunch"},
                                    "relevance_summary": "Very similar product shape.",
                                    "traction_summary": "Early traction.",
                                }
                            ]
                        }
                    )
                }
            ),
        )

    execution = llm_connector.LlmConnector(transport=transport).scout_competitors(
        {
            "altitut_context": main.DEFAULT_ALTITUT_CONTEXT,
            "focus_keywords": ["customer discovery"],
            "notes": ["Keep only extremely similar competitors."],
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

    assert captured["body"]["model"] == "gpt-4.1-mini"
    assert captured["url"].endswith("/responses")
    assert execution.candidates[0]["name"] == "LearnLaunch"


def test_llm_remote_analysis_uses_transport_and_parses_json(monkeypatch: Any) -> None:
    monkeypatch.setattr(llm_connector, "load_llm_config", lambda: _llm_config(enabled=True, api_key="sk-test", model="gpt-4.1-mini"))

    captured: dict[str, Any] = {}

    def transport(method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: int) -> tuple[int, str]:
        captured["method"] = method
        captured["url"] = url
        captured["headers"] = headers
        captured["timeout"] = timeout
        captured["body"] = json.loads((body or b"{}").decode("utf-8"))
        return (
            200,
            json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": {
                                    "summary": "Remote summary",
                                    "why_it_worked": ["Strong hook"],
                                    "design_pattern": ["Clear framing"],
                                    "altitut_adaptation": ["Adapt the opener"],
                                    "reasoning": "Remote model produced the analysis.",
                                    "confidence": 0.97,
                                }
                            }
                        }
                    ]
                }
            ),
        )

    analysis = llm_connector.LlmConnector(transport=transport).analyze_post(
        {
            "id": "post-1",
            "competitor_name": "Creator One",
            "source_platform": "instagram",
            "caption": "Hook-driven caption",
        },
        context={"retrieval_mode": "popular"},
    )

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/chat/completions")
    assert captured["body"]["model"] == "gpt-4.1-mini"
    assert analysis["provider"] == "openai-compatible"
    assert analysis["model"] == "gpt-4.1-mini"
    assert analysis["status"] == "completed"
    assert analysis["summary"] == "Remote summary"


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
