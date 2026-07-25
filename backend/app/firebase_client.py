"""Firebase Admin SDK initialisation and lazy Firestore client proxy."""

from __future__ import annotations

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import settings


def _init_app() -> firebase_admin.App:
    if firebase_admin._apps:  # noqa: SLF001
        return firebase_admin.get_app()

    if settings.firebase_service_account_path:
        cred = credentials.Certificate(settings.firebase_service_account_path)
    else:
        # Application Default Credentials on GCP / local gcloud auth.
        cred = credentials.ApplicationDefault()

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
}
