from __future__ import annotations

from backend.connectors.base import IntegrationStatus, SetupRequiredResponse
from backend.settings import load_apify_config


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


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
                "Choose the first Apify actor for the Instagram data path and fill in actor_id."
            )

        if not config.dataset_id:
            next_steps.append(
                "If your first Apify flow writes to a dataset, populate dataset_id after you create it."
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
