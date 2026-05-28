from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class SetupRequiredResponse:
    provider: str
    ready: bool = False
    status: str = "setup_required"
    missing_requirements: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)
    docs_url: str = ""
    details: dict[str, Any] = field(default_factory=dict)

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


@dataclass(slots=True)
class IntegrationStatus:
    provider: str
    ready: bool
    status: str
    missing_requirements: list[str]
    next_steps: list[str]
    docs_url: str
    details: dict[str, Any] = field(default_factory=dict)

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
