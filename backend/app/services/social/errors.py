"""Social publishing error types."""

from __future__ import annotations

import random


class SocialPublishError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False, raw: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.raw = raw or {}


def backoff_ms(attempt: int) -> int:
    cap = 60_000
    return random.randint(0, min(1000 * (2**attempt), cap))
