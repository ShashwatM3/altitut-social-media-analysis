from __future__ import annotations

import http.client
import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from backend.connectors.base import IntegrationStatus, SetupRequiredResponse
from backend.settings import load_llm_config


def _api_key_issue(api_key_env: str, api_key: str) -> str | None:
    if not api_key:
        return None
    if api_key.startswith(api_key_env):
        return "api_key_value_includes_env_var_name"
    if api_key.startswith(("Bearer ", "bearer ")):
        return "api_key_value_includes_bearer_prefix"
    return None

TransportResponse = tuple[int, str]
Transport = Callable[[str, str, dict[str, str], bytes | None, int], TransportResponse]


@dataclass(slots=True)
class LlmAnalysisExecution:
    analysis: dict[str, Any]
    raw_response: dict[str, Any]


@dataclass(slots=True)
class LlmScoutExecution:
    candidates: list[dict[str, Any]]
    raw_response: dict[str, Any]


class LlmExecutionError(RuntimeError):
    pass


class LlmSetupRequiredError(LlmExecutionError):
    pass


class LlmConnector:
    provider_name = "openai-compatible"

    def __init__(self, transport: Transport | None = None) -> None:
        self._transport = transport or _default_transport

    def status(self) -> IntegrationStatus:
        config = load_llm_config()
        api_key_issue = _api_key_issue(config.api_key_env, config.api_key)
        remote_ready = bool(config.api_key and config.model and not api_key_issue)
        missing: list[str] = []
        next_steps: list[str] = []

        if not config.enabled:
            missing.append("provider.enabled")
            next_steps.append("Set enabled = true in configs/providers/llm.toml.")
        if not config.api_key:
            missing.append(config.api_key_env)
            next_steps.append(f"Set {config.api_key_env} in your environment.")
        elif api_key_issue:
            missing.append(config.api_key_env)
            next_steps.append(
                f"Set {config.api_key_env} to the secret value only; do not include the variable name or an '=' prefix in the value."
            )
        if not config.model:
            missing.append("provider.model")
            next_steps.append("Choose a compatible chat model and set provider.model.")

        ready = config.enabled and remote_ready
        details = {
            "config": {
                "name": config.name,
                "enabled": config.enabled,
                "api_key_env": config.api_key_env,
                "base_url": config.base_url,
                "model": config.model,
                "timeout_seconds": config.timeout_seconds,
            },
            "docs_url": config.docs_url,
            "setup_steps": config.setup_steps,
            "mode": "remote" if ready else "setup_required",
        }
        if api_key_issue:
            details["api_key_issue"] = api_key_issue
        return IntegrationStatus(
            provider=config.name,
            ready=ready,
            status="ready" if ready else "setup_required",
            missing_requirements=_dedupe(missing),
            next_steps=_dedupe(config.setup_steps + next_steps),
            docs_url=config.docs_url,
            details=details,
        )

    def setup_required(self) -> SetupRequiredResponse:
        status = self.status()
        return SetupRequiredResponse(
            provider=status.provider,
            ready=status.ready,
            status=status.status,
            missing_requirements=status.missing_requirements,
            next_steps=status.next_steps,
            docs_url=status.docs_url,
            details=status.details,
        )

    def analyze_competitor(
        self,
        candidate: dict[str, Any],
        *,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        config = load_llm_config()
        if not self.status().ready:
            raise LlmSetupRequiredError("LLM setup is required before competitor analysis can run.")
        prompt = _build_competitor_prompt(candidate, context=context or {}, model=config.model)
        response = self._chat_completion(prompt)
        analysis = _coerce_analysis_object(response)
        analysis.setdefault("provider", config.name)
        analysis.setdefault("model", config.model)
        analysis.setdefault("status", "completed")
        return analysis

    def scout_competitors(
        self,
        scout_input: dict[str, Any],
    ) -> LlmScoutExecution:
        config = load_llm_config()
        if not self.status().ready:
            raise LlmSetupRequiredError("LLM setup is required before competitor scouting can run.")
        prompt = _build_scout_prompt(scout_input, model=config.model)
        response = self._responses_completion(prompt)
        candidates = _coerce_scout_candidates(response)
        return LlmScoutExecution(candidates=candidates, raw_response=response)

    def analyze_post(
        self,
        post: dict[str, Any],
        *,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        config = load_llm_config()
        if not self.status().ready:
            raise LlmSetupRequiredError("LLM setup is required before post analysis can run.")
        prompt = _build_post_prompt(post, context=context or {}, model=config.model)
        response = self._chat_completion(prompt)
        analysis = _coerce_analysis_object(response)
        analysis.setdefault("provider", config.name)
        analysis.setdefault("model", config.model)
        analysis.setdefault("status", "completed")
        return analysis

    def _chat_completion(self, prompt: dict[str, Any]) -> dict[str, Any]:
        config = load_llm_config()
        api_key_issue = _api_key_issue(config.api_key_env, config.api_key)
        if api_key_issue:
            raise LlmSetupRequiredError(
                f"{config.api_key_env} appears malformed ({api_key_issue}); set the secret value only."
            )
        base_url = urlparse(config.base_url)
        if base_url.scheme not in {"https", "http"}:
            raise LlmExecutionError("LLM base_url must use http or https.")
        if not base_url.hostname:
            raise LlmExecutionError("LLM base_url must include a hostname.")
        path = base_url.path.rstrip("/") + "/chat/completions"
        if not path.startswith("/"):
            path = "/" + path
        request_body = {
            "model": config.model,
            "messages": prompt["messages"],
            "temperature": prompt.get("temperature", 0.2),
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        status_code, body_text = self._transport(
            "POST",
            _compose_url(base_url, path),
            headers,
            json.dumps(request_body).encode("utf-8"),
            config.timeout_seconds,
        )
        if status_code >= 400:
            raise _error_from_status(status_code, body_text)
        if not body_text.strip():
            raise LlmExecutionError("LLM returned an empty response.")
        try:
            raw_response = json.loads(body_text)
        except json.JSONDecodeError as exc:
            raise LlmExecutionError("LLM returned invalid JSON.") from exc
        if not isinstance(raw_response, dict):
            raise LlmExecutionError("LLM response was not a JSON object.")
        return raw_response

    def _responses_completion(self, prompt: dict[str, Any]) -> dict[str, Any]:
        config = load_llm_config()
        api_key_issue = _api_key_issue(config.api_key_env, config.api_key)
        if api_key_issue:
            raise LlmSetupRequiredError(
                f"{config.api_key_env} appears malformed ({api_key_issue}); set the secret value only."
            )
        base_url = urlparse(config.base_url)
        if base_url.scheme not in {"https", "http"}:
            raise LlmExecutionError("LLM base_url must use http or https.")
        if not base_url.hostname:
            raise LlmExecutionError("LLM base_url must include a hostname.")
        path = base_url.path.rstrip("/") + "/responses"
        if not path.startswith("/"):
            path = "/" + path
        request_body = {
            "model": config.model,
            "instructions": prompt["instructions"],
            "input": prompt["input"],
            "temperature": prompt.get("temperature", 0.2),
            "tools": [{"type": "web_search"}],
            "tool_choice": "required",
        }
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        status_code, body_text = self._transport(
            "POST",
            _compose_url(base_url, path),
            headers,
            json.dumps(request_body).encode("utf-8"),
            config.timeout_seconds,
        )
        if status_code >= 400:
            raise _error_from_status(status_code, body_text)
        if not body_text.strip():
            raise LlmExecutionError("LLM returned an empty response.")
        try:
            raw_response = json.loads(body_text)
        except json.JSONDecodeError as exc:
            raise LlmExecutionError("LLM returned invalid JSON.") from exc
        if not isinstance(raw_response, dict):
            raise LlmExecutionError("LLM response was not a JSON object.")
        return raw_response


def _build_scout_prompt(scout_input: dict[str, Any], *, model: str) -> dict[str, Any]:
    altitut_context = scout_input.get("altitut_context", "")
    focus_keywords = scout_input.get("focus_keywords", [])
    notes = scout_input.get("notes", [])
    approved_companies = scout_input.get("approved_companies", [])
    instructions = (
        "You are Competitor Scout for Altitut. Use live web search to verify real companies and social profiles. "
        "Return at least 10 candidates. Every candidate must be an exact or extremely similar competitor to Altitut "
        "in product shape and user workflow; do not include anything vaguely similar, adjacent, inspirational, or "
        "loosely related. The target pattern is entrepreneurship teaching for learners or early-stage founders with "
        "customer discovery, pitch practice, idea validation, and progress tracking in one product. Exclude "
        "accelerators, incubators, venture funds, founder networks, and generic startup programs unless they are "
        "actually software platforms that match that product pattern. If approved_companies is non-empty, do not return "
        "any company whose name, website, brand, or obvious identity matches one of the approved companies. Return "
        "JSON only with keys: candidates, reasoning, search_signals. candidates must be an array of objects with keys: "
        "id, name, website, social_links, relevance_summary, traction_summary. Each candidate must include at least "
        "one verified social link in social_links when available. social_links may include instagram, linkedin, x, "
        "youtube, tiktok, facebook, or threads. If a social link is unknown, omit it. Keep each summary concise, "
        "concrete, and grounded in the context."
    )
    return {
        "temperature": 0.25,
        "instructions": instructions,
        "input": json.dumps(
            {
                "model": model,
                "altitut_context": altitut_context,
                "focus_keywords": focus_keywords,
                "notes": notes,
                "approved_companies": approved_companies,
            },
            ensure_ascii=False,
            indent=2,
        ),
    }


def _build_competitor_prompt(
    candidate: dict[str, Any],
    *,
    context: dict[str, Any],
    model: str,
) -> dict[str, Any]:
    return {
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You analyze social-media competitors for Altitut. Return JSON only with keys: "
                    "relevance_summary, traction_summary, reasoning, key_signals, confidence. "
                    "Keep summaries concise and concrete."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "model": model,
                        "context": context,
                        "candidate": candidate,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            },
        ],
    }


def _build_post_prompt(
    post: dict[str, Any],
    *,
    context: dict[str, Any],
    model: str,
) -> dict[str, Any]:
    return {
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You analyze competitor posts for Altitut. Return JSON only with keys: summary, "
                    "why_it_worked, design_pattern, altitut_adaptation, reasoning, confidence. "
                    "Be specific and actionable."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "model": model,
                        "context": context,
                        "post": post,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            },
        ],
    }


def _coerce_json_object(response: dict[str, Any]) -> dict[str, Any]:
    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, dict):
                    return content
                if isinstance(content, str):
                    parsed = _maybe_parse_json(content)
                    if isinstance(parsed, dict):
                        return parsed
    parsed = _maybe_parse_json(response.get("content"))
    if isinstance(parsed, dict):
        return parsed
    direct = response.get("analysis")
    if isinstance(direct, dict):
        return direct
    output_text = response.get("output_text")
    if isinstance(output_text, str):
        parsed = _maybe_parse_json(output_text)
        if isinstance(parsed, dict):
            return parsed
    output = response.get("output")
    if isinstance(output, list):
        collected: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            for key in ("text", "content"):
                value = item.get(key)
                if isinstance(value, str) and value.strip():
                    collected.append(value)
                elif isinstance(value, list):
                    for part in value:
                        if isinstance(part, dict):
                            text = part.get("text") or part.get("value")
                            if isinstance(text, str) and text.strip():
                                collected.append(text)
        if collected:
            parsed = _maybe_parse_json("\n".join(collected))
            if isinstance(parsed, dict):
                return parsed
    return {}


def _coerce_scout_candidates(response: dict[str, Any]) -> list[dict[str, Any]]:
    parsed = _coerce_json_object(response)
    if isinstance(parsed.get("candidates"), list):
        candidates = [candidate for candidate in parsed["candidates"] if isinstance(candidate, dict)]
        if candidates:
            return candidates
    if isinstance(parsed.get("competitors"), list):
        candidates = [candidate for candidate in parsed["competitors"] if isinstance(candidate, dict)]
        if candidates:
            return candidates
    raise LlmExecutionError("LLM response did not include competitor candidates.")


def _coerce_analysis_object(response: dict[str, Any]) -> dict[str, Any]:
    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, dict):
                    return content
                if isinstance(content, str):
                    parsed = _maybe_parse_json(content)
                    if isinstance(parsed, dict):
                        return parsed
    parsed = _maybe_parse_json(response.get("content"))
    if isinstance(parsed, dict):
        return parsed
    direct = response.get("analysis")
    if isinstance(direct, dict):
        return direct
    raise LlmExecutionError("LLM response did not include a structured analysis payload.")


def _maybe_parse_json(value: Any) -> Any:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.startswith("```"):
        text = text.strip("`")
        if "\n" in text:
            text = text.split("\n", 1)[1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _compose_url(base_url: Any, path: str) -> str:
    scheme = base_url.scheme or "https"
    host = base_url.netloc
    return f"{scheme}://{host}{path}"


def _default_transport(
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes | None,
    timeout: int,
) -> TransportResponse:
    parsed = urlparse(url)
    connection_cls: type[http.client.HTTPConnection]
    if parsed.scheme == "https":
        connection_cls = http.client.HTTPSConnection
    elif parsed.scheme == "http":
        connection_cls = http.client.HTTPConnection
    else:
        raise LlmExecutionError("LLM requests must use HTTP or HTTPS.")
    connection = connection_cls(
        parsed.hostname or "",
        parsed.port or (443 if parsed.scheme == "https" else 80),
        timeout=timeout,
    )
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        payload = response.read().decode("utf-8")
        return response.status, payload
    except OSError as exc:
        raise LlmExecutionError(f"Unable to reach LLM provider: {exc}") from exc
    finally:
        connection.close()


def _error_from_status(status_code: int, message: str) -> LlmExecutionError:
    if status_code in {401, 403, 404, 422}:
        return LlmSetupRequiredError(
            f"LLM setup needs attention (HTTP {status_code}): {message or 'no response body'}"
        )
    return LlmExecutionError(f"LLM request failed (HTTP {status_code}): {message or 'no response body'}")


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result
