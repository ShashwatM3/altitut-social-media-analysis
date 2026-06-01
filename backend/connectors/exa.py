from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import http.client
import json
import re
from typing import Any
import urllib.request
from urllib.parse import urlparse

from backend.connectors.base import IntegrationStatus, SetupRequiredResponse
from backend.settings import load_exa_config


TransportResponse = tuple[int, str]
Transport = Callable[[str, str, dict[str, str], bytes | None, int], TransportResponse]


@dataclass(slots=True)
class ExaScoutExecution:
    run_id: str
    raw_response: dict[str, Any]
    candidates: list[dict[str, Any]]
    search_queries: list[str]


class ExaExecutionError(RuntimeError):
    pass


class ExaSetupRequiredError(ExaExecutionError):
    pass


class ExaConnector:
    provider_name = "exa"

    def __init__(self, transport: Any | None = None) -> None:
        self._transport = transport or _default_transport

    def status(self) -> IntegrationStatus:
        config = load_exa_config()
        missing: list[str] = []
        next_steps: list[str] = []

        if not config.enabled:
            missing.append("provider.enabled")
            next_steps.append("Set enabled = true in configs/providers/exa.toml.")
        if not config.api_key:
            missing.append(config.api_key_env)
            next_steps.append(f"Set {config.api_key_env} in your environment.")

        ready = config.enabled and bool(config.api_key)
        details = {
            "config": {
                "name": config.name,
                "enabled": config.enabled,
                "api_key_env": config.api_key_env,
                "base_url": config.base_url,
                "timeout_seconds": config.timeout_seconds,
            },
            "docs_url": config.docs_url,
            "setup_steps": config.setup_steps,
            "mode": "remote" if ready else "setup_required",
        }
        return IntegrationStatus(
            provider=self.provider_name,
            ready=ready,
            status="ready" if ready else "setup_required",
            missing_requirements=missing,
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

    def scout_competitors(self, scout_input: dict[str, Any]) -> ExaScoutExecution:
        config = load_exa_config()
        if not self.status().ready:
            raise ExaSetupRequiredError("Exa setup is required before competitor scouting can run.")
        search_queries = _build_search_queries(scout_input)
        request_body = _build_search_request(scout_input, search_queries)
        status_code, body_text = self._transport(
            "POST",
            _compose_url(config.base_url, "/search"),
            {
                "x-api-key": config.api_key,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json.dumps(request_body).encode("utf-8"),
            config.timeout_seconds,
        )
        if status_code >= 400:
            raise _error_from_status(status_code, body_text)
        if not body_text.strip():
            raise ExaExecutionError("Exa returned an empty response.")
        try:
            raw_response = json.loads(body_text)
        except json.JSONDecodeError as exc:
            raise ExaExecutionError("Exa returned invalid JSON.") from exc
        if not isinstance(raw_response, dict):
            raise ExaExecutionError("Exa response was not a JSON object.")
        candidates = _coerce_candidates(raw_response)
        return ExaScoutExecution(
            run_id=str(raw_response.get("requestId") or raw_response.get("request_id") or "exa-search"),
            raw_response=raw_response,
            candidates=candidates,
            search_queries=search_queries,
        )


def _build_search_queries(scout_input: dict[str, Any]) -> list[str]:
    context = str(scout_input.get("altitut_context", "") or "").strip()
    focus_keywords = [str(value).strip() for value in scout_input.get("focus_keywords", []) if isinstance(value, str) and value.strip()]
    notes = [str(value).strip() for value in scout_input.get("notes", []) if isinstance(value, str) and value.strip()]

    base_terms = _compact_terms(context)
    if focus_keywords:
        base_terms.extend(focus_keywords)
    if notes:
        base_terms.extend(notes)

    seed = " ".join(base_terms[:18]).strip()
    if not seed:
        seed = "startup learning platform customer discovery pitch practice"

    return [
        f'companies like Altitut platform for learners founders {seed}',
        f'software platform customer discovery pitch practice idea validation {seed}',
        f'learning modules startup momentum founders platform {seed}',
        f'founder education platform customer discovery {seed}',
    ]


def _build_search_request(scout_input: dict[str, Any], search_queries: list[str]) -> dict[str, Any]:
    altitut_context = str(scout_input.get("altitut_context", "") or "").strip()
    focus_keywords = [str(value).strip() for value in scout_input.get("focus_keywords", []) if isinstance(value, str) and value.strip()]
    notes = [str(value).strip() for value in scout_input.get("notes", []) if isinstance(value, str) and value.strip()]
    approved_companies = scout_input.get("approved_companies", [])
    primary_query = search_queries[0]
    additional_queries = search_queries[1:]
    return {
        "query": primary_query,
        "additionalQueries": additional_queries,
        "type": "deep",
        "category": "company",
        "numResults": 20,
        "systemPrompt": (
            "Find only real companies that are exact or extremely similar to Altitut in product shape and user workflow. "
            "Return at least 10 candidates. Do not include anything vaguely similar, adjacent, inspirational, or loosely "
            "related. The target pattern is entrepreneurship teaching for learners or early-stage founders with customer "
            "discovery, pitch practice, idea validation, and progress tracking in one product. Exclude accelerators, "
            "incubators, venture funds, founder networks, and generic startup programs unless they are actually software "
            "platforms that match that product pattern. If approved_companies is non-empty, do not return any company whose "
            "name, website, brand, or obvious identity matches one of the approved companies. Return JSON only with "
            "candidates, reasoning, and search_signals. Each candidate must include id, name, website, social_links, "
            "relevance_summary, and traction_summary. social_links should include any real public profiles you can verify."
        ),
        "outputSchema": {
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "website": {"type": "string"},
                            "social_links": {"type": "object"},
                            "relevance_summary": {"type": "string"},
                            "traction_summary": {"type": "string"},
                        },
                        "required": ["name", "website", "social_links", "relevance_summary", "traction_summary"],
                    },
                },
                "reasoning": {"type": "string"},
                "search_signals": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["candidates"],
        },
        "queryContext": {
            "altitut_context": altitut_context,
            "focus_keywords": focus_keywords,
            "notes": notes,
            "approved_companies": approved_companies,
        },
    }


def _coerce_candidates(response: dict[str, Any]) -> list[dict[str, Any]]:
    parsed = _coerce_json_object(response)
    if isinstance(parsed.get("candidates"), list):
        candidates = [candidate for candidate in parsed["candidates"] if isinstance(candidate, dict)]
        if candidates:
            return candidates
    results = response.get("results")
    if isinstance(results, list):
        candidates: list[dict[str, Any]] = []
        for index, result in enumerate(results):
            if not isinstance(result, dict):
                continue
            url = str(result.get("url") or "").strip()
            title = str(result.get("title") or "").strip()
            if not url and not title:
                continue
            candidate_name = title or _domain_from_url(url) or f"exa-result-{index + 1}"
            social_links = _social_links_from_result(result)
            if not social_links and url:
                social_links = _extract_social_links_from_website(url)
            candidates.append(
                {
                    "id": _slugify(candidate_name) or f"exa-result-{index + 1}",
                    "name": candidate_name,
                    "website": url or None,
                    "social_links": social_links,
                    "relevance_summary": _result_summary(result),
                    "traction_summary": _result_traction(result),
                }
            )
        if candidates:
            return candidates
    raise ExaExecutionError("Exa response did not include competitor candidates.")


def _coerce_json_object(response: dict[str, Any]) -> dict[str, Any]:
    content = response.get("content")
    if isinstance(content, dict):
        return content
    if isinstance(content, str):
        parsed = _maybe_parse_json(content)
        if isinstance(parsed, dict):
            return parsed
    output = response.get("output")
    if isinstance(output, dict):
        return output
    if isinstance(response.get("output_text"), str):
        parsed = _maybe_parse_json(response["output_text"])
        if isinstance(parsed, dict):
            return parsed
    return {}


def _social_links_from_result(result: dict[str, Any]) -> dict[str, str]:
    social_links: dict[str, str] = {}
    for field in ("social_links", "socialLinks"):
        value = result.get(field)
        if isinstance(value, dict):
            for key, link in value.items():
                if isinstance(key, str) and isinstance(link, str) and link.strip():
                    social_links[key.lower()] = link.strip()
    return social_links


def _extract_social_links_from_website(url: str) -> dict[str, str]:
    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html,application/xhtml+xml"},
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                return {}
            html = response.read().decode("utf-8", errors="ignore")
    except OSError:
        return {}
    return _extract_social_links_from_html(html)


def _extract_social_links_from_html(html: str) -> dict[str, str]:
    social_links: dict[str, str] = {}
    for match in re.finditer(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE):
        href = match.group(1).strip()
        if not href.startswith(("http://", "https://")):
            continue
        key = _social_platform_key(href)
        if key and key not in social_links:
            social_links[key] = href
    return social_links


def _social_platform_key(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    if "instagram.com" in host:
        return "instagram"
    if "linkedin.com" in host:
        return "linkedin"
    if host in {"x.com", "twitter.com"}:
        return "x"
    if "youtube.com" in host or host == "youtu.be":
        return "youtube"
    if "tiktok.com" in host:
        return "tiktok"
    if "facebook.com" in host or host == "fb.com":
        return "facebook"
    if "threads.net" in host:
        return "threads"
    return None


def _result_summary(result: dict[str, Any]) -> str:
    for field in ("relevance_summary", "summary", "text", "highlight"):
        value = result.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Live search result from Exa."


def _result_traction(result: dict[str, Any]) -> str:
    for field in ("traction_summary", "highlights", "text"):
        value = result.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, list) and value:
            joined = " ".join(str(item).strip() for item in value if str(item).strip())
            if joined:
                return joined
    return "Live search presence observed through Exa."


def _compose_url(base_url: str, path: str) -> str:
    parsed = urlparse(base_url)
    scheme = parsed.scheme or "https"
    host = parsed.netloc or parsed.path
    root_path = parsed.path.rstrip("/") if parsed.netloc else ""
    return f"{scheme}://{host}{root_path}{path}"


def _domain_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    return host or url


def _compact_terms(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z0-9][a-zA-Z0-9\-]+", text.lower())
    result: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        result.append(token)
    return result


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:80]


def _maybe_parse_json(value: Any) -> Any:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


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
        raise ExaExecutionError("Exa requests must use HTTP or HTTPS.")
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
        raise ExaExecutionError(f"Unable to reach Exa provider: {exc}") from exc
    finally:
        connection.close()


def _error_from_status(status_code: int, message: str) -> ExaExecutionError:
    if status_code in {401, 403, 404, 422}:
        return ExaSetupRequiredError(
            f"Exa setup needs attention (HTTP {status_code}): {message or 'no response body'}"
        )
    return ExaExecutionError(f"Exa request failed (HTTP {status_code}): {message or 'no response body'}")


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result
