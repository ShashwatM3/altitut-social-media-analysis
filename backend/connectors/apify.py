from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from backend.connectors.base import IntegrationStatus, SetupRequiredResponse
from backend.settings import load_apify_config


@dataclass
class ScoutExecution:
    run_id: str
    dataset_id: str
    raw_run: dict[str, Any]
    raw_items: list[dict[str, Any]]
    candidates: list[dict[str, Any]]


class ApifyExecutionError(RuntimeError):
    pass


class ApifySetupRequiredError(ApifyExecutionError):
    pass


class ApifyConnector:
    provider_name = "apify"

    def status(self) -> IntegrationStatus:
        config = load_apify_config()
        missing: list[str] = []
        next_steps: list[str] = []

        if not config.enabled:
            missing.append("provider.enabled")
            next_steps.append("Set enabled = true in configs/providers/apify.toml.")

        if not config.token:
            missing.append(config.token_env)
            next_steps.append(
                f"Create an Apify API token and export it as {config.token_env}."
            )

        if not config.actor_id:
            missing.append("provider.actor_id")
            next_steps.append(
                "Choose the Apify actor for the Instagram data path and fill in actor_id."
            )

        if not config.dataset_id:
            next_steps.append(
                "If your Apify flow writes to a dataset, populate dataset_id after it runs."
            )

        ready = len(missing) == 0
        status = "ready" if ready else "setup_required"
        details = {
            "default_platform": config.default_platform,
            "docs_url": config.docs_url,
            "setup_steps": config.setup_steps,
            "config": {
                "name": config.name,
                "enabled": config.enabled,
                "token_env": config.token_env,
                "actor_id": config.actor_id,
                "dataset_id": config.dataset_id,
            },
        }
        return IntegrationStatus(
            provider=self.provider_name,
            ready=ready,
            status=status,
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

    def execute_competitor_scout(
        self,
        scout_input: dict[str, Any],
        wait_for_finish: int = 120,
    ) -> ScoutExecution:
        config = load_apify_config()
        status = self.status()
        if not status.ready:
            raise ApifySetupRequiredError(
                "Apify setup is required before competitor scouting can run."
            )
        if not config.token:
            raise ApifySetupRequiredError(f"Missing {config.token_env}.")
        if not config.actor_id:
            raise ApifySetupRequiredError("Missing provider.actor_id in configs/providers/apify.toml.")

        actor_input = {
            "altitut_context": scout_input.get("altitut_context", ""),
            "focus_keywords": scout_input.get("focus_keywords", []),
            "notes": scout_input.get("notes", []),
            "default_platform": config.default_platform,
            "source": "altitut-social-media-analysis",
        }
        run_url = (
            f"https://api.apify.com/v2/acts/{quote(config.actor_id, safe='')}/runs"
            f"?waitForFinish={wait_for_finish}"
        )
        run_response = self._request_json("POST", run_url, config.token, payload=actor_input)
        run_data = _unwrap_data(run_response)
        run_id = str(run_data.get("id") or config.actor_id or "apify-run")
        status_value = str(run_data.get("status") or "").upper()
        if status_value and status_value not in {"SUCCEEDED", "READY"}:
            raise ApifyExecutionError(
                f"Apify run {run_id or '<unknown>'} finished with status {status_value}."
            )

        dataset_id = str(run_data.get("defaultDatasetId") or config.dataset_id or "")
        if not dataset_id:
            raise ApifyExecutionError(
                "Apify run completed but no dataset id was returned by the actor or config."
            )

        items_url = (
            f"https://api.apify.com/v2/datasets/{quote(dataset_id, safe='')}/items"
            "?clean=true&format=json"
        )
        items_response = self._request_json("GET", items_url, config.token)
        raw_items = _coerce_item_list(items_response)
        candidates = [
            self.normalize_candidate(item, index=index, run_id=run_id, platform=config.default_platform)
            for index, item in enumerate(raw_items)
        ]
        return ScoutExecution(
            run_id=run_id,
            dataset_id=dataset_id,
            raw_run=run_data,
            raw_items=raw_items,
            candidates=candidates,
        )

    @staticmethod
    def normalize_candidate(
        item: dict[str, Any],
        *,
        index: int,
        run_id: str,
        platform: str,
    ) -> dict[str, Any]:
        identity = _candidate_identity(item, index=index)
        candidate_id = f"competitor-{identity}"
        name = _pick_text(
            item,
            "name",
            "companyName",
            "profileName",
            "title",
            "username",
            "handle",
            fallback=identity.replace("-", " ").title(),
        )
        website = _pick_text(item, "website", "url", "homepage", "domain") or None
        social_links = _extract_social_links(item)
        relevance_summary = _pick_text(
            item,
            "relevance_summary",
            "relevanceSummary",
            "summary",
            "description",
            fallback=f"Candidate discovered for {platform} competitor research.",
        )
        traction_summary = _build_traction_summary(item)
        return {
            "id": candidate_id,
            "name": name,
            "website": website,
            "social_links": social_links,
            "relevance_summary": relevance_summary,
            "traction_summary": traction_summary,
            "source_run_id": run_id,
        }

    def _request_json(
        self,
        method: str,
        url: str,
        token: str,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        data = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=180) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            raise _error_from_http(exc) from exc
        except URLError as exc:
            raise ApifyExecutionError(f"Unable to reach Apify API: {exc.reason}") from exc
        if not body:
            return {}
        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise ApifyExecutionError("Apify returned invalid JSON.") from exc


def _error_from_http(exc: HTTPError) -> ApifyExecutionError:
    message = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else str(exc)
    if exc.code in {401, 403, 404, 422}:
        return ApifySetupRequiredError(
            f"Apify setup needs attention (HTTP {exc.code}): {message or exc.reason}"
        )
    return ApifyExecutionError(f"Apify request failed (HTTP {exc.code}): {message or exc.reason}")


def _unwrap_data(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, dict):
            return data
        return payload
    raise ApifyExecutionError("Apify response was not a JSON object.")


def _coerce_item_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    return []


def _candidate_identity(item: dict[str, Any], *, index: int) -> str:
    for key in ("id", "name", "companyName", "profileName", "username", "handle", "website", "url"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return _slugify(value)
    return f"item-{index + 1}"


def _pick_text(item: dict[str, Any], *keys: str, fallback: str = "") -> str:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def _extract_social_links(item: dict[str, Any]) -> dict[str, str]:
    raw = item.get("social_links") or item.get("socialLinks") or item.get("links")
    links: dict[str, str] = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            if isinstance(value, str) and value.strip():
                links[str(key)] = value.strip()
    elif isinstance(raw, list):
        for entry in raw:
            if isinstance(entry, dict):
                label = entry.get("label") or entry.get("platform") or entry.get("name")
                url = entry.get("url") or entry.get("href")
                if isinstance(label, str) and isinstance(url, str) and label.strip() and url.strip():
                    links[label.strip()] = url.strip()
    for key in ("instagram", "linkedin", "x", "twitter", "website"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            links.setdefault(key, value.strip())
    return links


def _build_traction_summary(item: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("followers", "followersCount", "engagement", "engagementRate", "posts", "postCount"):
        value = item.get(key)
        if isinstance(value, (int, float)):
            parts.append(f"{key}={value}")
        elif isinstance(value, str) and value.strip():
            parts.append(f"{key}={value.strip()}")
    if parts:
        return "; ".join(parts)
    return "No traction metrics returned by the actor item."


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result
