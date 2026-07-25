"""Firestore CRUD for published social posts."""

from __future__ import annotations

from app.firebase_client import COLLECTIONS, db
from app.models import SocialPost


def save_social_post(post: SocialPost) -> None:
    data = post.model_dump(mode="json", exclude_none=True)
    db.collection(COLLECTIONS["socialPosts"]).document(post.id).set(data)


def delete_social_post(post_id: str) -> None:
    db.collection(COLLECTIONS["socialPosts"]).document(post_id).delete()


def get_social_post(post_id: str) -> SocialPost | None:
    doc = db.collection(COLLECTIONS["socialPosts"]).document(post_id).get()
    if doc.exists:
        return SocialPost.model_validate(doc.to_dict())
    return None
