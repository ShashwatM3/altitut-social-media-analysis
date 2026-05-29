from __future__ import annotations

import http.client
import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from backend.connectors.base import IntegrationStatus, SetupRequiredResponse
from backend.settings import load_llm_config

TransportResponse = tuple[int, str]
Transport = Callable[[str, str, dict[str, str], bytes | None, int], TransportResponse]


@dataclass(slots=True)
class LlmAnalysisExecution:
    analysis: dict[str, Any]
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
        remote_ready = bool(config.api_key and config.model)
        offline_ready = bool(config.enabled and config.offline_fallback and not remote_ready)
        missing: list[str] = []
        next_steps: list[str] = []

        if not config.enabled:
            missing.append("provider.enabled")
            next_steps.append("Set enabled = true in configs/providers/llm.toml.")
        elif not remote_ready and not config.offline_fallback:
            if not config.api_key:
                missing.append(config.api_key_env)
                next_steps.append(f"Set {config.api_key_env} in your environment.")
            if not config.model:
                missing.append("provider.model")
                next_steps.append("Choose a compatible chat model and set provider.model.")

        ready = config.enabled and (remote_ready or offline_ready)
        mode = "remote" if remote_ready else ("offline" if offline_ready else "setup_required")
        provider = config.name if remote_ready else ("offline-heuristic" if offline_ready else self.provider_name)
        details = {
            "config": {
                "name": config.name,
                "enabled": config.enabled,
                "api_key_env": config.api_key_env,
                "base_url": config.base_url,
                "model": config.model,
                "timeout_seconds": config.timeout_seconds,
                "offline_fallback": config.offline_fallback,
            },
            "docs_url": config.docs_url,
            "setup_steps": config.setup_steps,
            "mode": mode,
        }
        if offline_ready:
            next_steps = [
                *config.setup_steps,
                "Optionally set OPENAI_API_KEY and provider.model to switch from offline fallback to a remote LLM.",
            ]
        return IntegrationStatus(
            provider=provider,
            ready=ready,
            status="ready" if ready else "setup_required",
            missing_requirements=missing,
            next_steps=_dedupe((config.setup_steps + next_steps) if not ready else next_steps),
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
        if config.api_key and config.model:
            prompt = _build_competitor_prompt(candidate, context=context or {}, model=config.model)
            response = self._chat_completion(prompt)
            analysis = _coerce_analysis_object(response)
            analysis.setdefault("provider", config.name)
            analysis.setdefault("model", config.model)
            analysis.setdefault("status", "completed")
            return analysis
        analysis = _offline_competitor_analysis(candidate, context=context or {})
        analysis.setdefault("provider", "offline-heuristic")
        analysis.setdefault("model", "offline-heuristic-v1")
        analysis.setdefault("status", "completed")
        return analysis

    def analyze_post(
        self,
        post: dict[str, Any],
        *,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        config = load_llm_config()
        if not self.status().ready:
            raise LlmSetupRequiredError("LLM setup is required before post analysis can run.")
        if config.api_key and config.model:
            prompt = _build_post_prompt(post, context=context or {}, model=config.model)
            response = self._chat_completion(prompt)
            analysis = _coerce_analysis_object(response)
            analysis.setdefault("provider", config.name)
            analysis.setdefault("model", config.model)
            analysis.setdefault("status", "completed")
            return analysis
        analysis = _offline_post_analysis(post, context=context or {})
        analysis.setdefault("provider", "offline-heuristic")
        analysis.setdefault("model", "offline-heuristic-v1")
        analysis.setdefault("status", "completed")
        return analysis

    def _chat_completion(self, prompt: dict[str, Any]) -> dict[str, Any]:
        config = load_llm_config()
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


def _offline_competitor_analysis(candidate: dict[str, Any], *, context: dict[str, Any]) -> dict[str, Any]:
    name = str(candidate.get("name") or candidate.get("id") or "Unknown competitor")
    website = str(candidate.get("website") or "").strip()
    social_links = candidate.get("social_links") if isinstance(candidate.get("social_links"), dict) else {}
    signals: list[str] = []
    for key, value in (social_links or {}).items():
        if isinstance(value, str) and value.strip():
            signals.append(f"{key}: {value}")
    if website:
        signals.append(f"website: {website}")
    focus_keywords = context.get("focus_keywords")
    if isinstance(focus_keywords, list) and focus_keywords:
        focus_text = ", ".join(str(item) for item in focus_keywords[:4])
    else:
        focus_text = "the same audience or category"
    summary = candidate.get("relevance_summary") or f"{name} is a relevant competitor for Altitut because it reaches {focus_text}."
    traction = candidate.get("traction_summary") or f"{name} shows observable traction signals from its public profile and related sources."
    return {
        "summary": summary,
        "relevance_summary": summary,
        "traction_summary": traction,
        "reasoning": [
            f"Public profile data for {name} suggests overlap with Altitut's target market.",
            "Signals were normalized from the source candidate and kept concise for review.",
        ],
        "key_signals": signals[:6],
        "confidence": 0.62 if signals else 0.45,
    }


def _offline_post_analysis(post: dict[str, Any], *, context: dict[str, Any]) -> dict[str, Any]:
    competitor_name = str(post.get("competitor_name") or post.get("competitor_id") or "Unknown company")
    title = str(post.get("title") or "").strip()
    caption = str(post.get("caption") or "").strip()
    transcript = str(post.get("transcript") or "").strip()
    retrieval_mode = str(context.get("retrieval_mode") or post.get("retrieval_mode") or "recent")
    hook = caption or transcript or title or "the post content"
    hook_excerpt = hook[:120]
    summary = f"{competitor_name} post analyzed for {retrieval_mode} retrieval."
    if hook_excerpt:
        summary = f"{summary} Key hook: {hook_excerpt}"
    return {
        "summary": summary,
        "why_it_worked": [
            f"The post presents a clear hook around: {hook_excerpt or 'the source content'}.",
            "The structure is concise enough for rapid review and reuse.",
        ],
        "design_pattern": [
            "Keep the opening hook short and direct.",
            "Pair the hook with a readable visual or content structure.",
        ],
        "altitut_adaptation": [
            f"Adapt the hook style for Altitut while matching the tone of {competitor_name}.",
            "Preserve the strongest structure, but make the message and visuals distinctly Altitut.",
        ],
        "reasoning": [
            "The local offline analysis uses the saved post fields to generate a concise strategic review.",
            "This is a deterministic fallback so the pipeline remains usable without external model keys.",
        ],
        "confidence": 0.58 if (caption or transcript or title) else 0.42,
    }


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
