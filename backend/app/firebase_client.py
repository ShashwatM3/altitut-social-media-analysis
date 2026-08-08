"""Firebase Admin SDK initialisation and lazy Firestore client proxy."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import settings


def _credential() -> credentials.Certificate:
    """Load a service-account credential from a file path or JSON string."""
    if settings.firebase_service_account_path:
        return credentials.Certificate(settings.firebase_service_account_path)

    if settings.firebase_service_account_json:
        try:
            parsed = json.loads(settings.firebase_service_account_json)
        except json.JSONDecodeError as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON") from exc
        # firebase-admin requires a file path; write the JSON to a temp file.
        temp_dir = Path(tempfile.gettempdir()) / "altitut-firebase"
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = temp_dir / "serviceAccountKey.json"
        temp_path.write_text(json.dumps(parsed))
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(temp_path)
        return credentials.Certificate(str(temp_path))

    # Application Default Credentials on GCP / local gcloud auth.
    return credentials.ApplicationDefault()


def _init_app() -> firebase_admin.App:
    if firebase_admin._apps:  # noqa: SLF001
        return firebase_admin.get_app()

    cred = _credential()

    return firebase_admin.initialize_app(
        cred,
        {"projectId": settings.firebase_project_id},
    )


class _FirestoreProxy:
    """Lazily initialise Firebase and return the Firestore client on first use."""

    def __init__(self) -> None:
        self._client: firestore.Client | None = None

    def _client_or_init(self) -> firestore.Client:
        if self._client is None:
            app = _init_app()
            self._client = firestore.client(app=app)
        return self._client

    def __getattr__(self, name: str):
        return getattr(self._client_or_init(), name)


db = _FirestoreProxy()

COLLECTIONS = {
    "competitors": "competitors",
    "contentPacks": "contentPacks",
    "ragChunks": "ragChunks",
    "scoutRuns": "scoutRuns",
    "telegramUpdates": "telegramUpdates",
    "socialPosts": "socialPosts",
    "socialAccounts": "socialAccounts",
    "postCampaigns": "postCampaigns",
    "campaignPosts": "campaignPosts",
}
