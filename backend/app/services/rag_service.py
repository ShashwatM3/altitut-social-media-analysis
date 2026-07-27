"""RAG chunking, ingestion, and hybrid retrieval."""

from __future__ import annotations

import math
import re
import time
from typing import Any

import numpy as np

from app.firebase_client import COLLECTIONS, db
from app.models import (
    AnalysisPack,
    PackEntry,
    PackEpisode,
    PendingChunk,
    RagChunk,
    RagDocType,
    RetrievedChunk,
)
from app.services.openai_client import embed_texts, slugify

_STOPWORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "and",
    "but",
    "or",
    "yet",
    "so",
    "if",
    "because",
    "although",
    "though",
    "while",
    "where",
    "when",
    "that",
    "which",
    "who",
    "whom",
    "whose",
    "what",
    "this",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
    "its",
    "our",
    "their",
    "mine",
    "yours",
    "hers",
    "ours",
    "theirs",
    "myself",
    "yourself",
    "himself",
    "herself",
    "itself",
    "ourselves",
    "yourselves",
    "themselves",
}


_cache: dict[str, Any] = {"chunks": None, "loaded_at": 0.0}
CACHE_TTL_SECONDS = 120


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _lexical_score(query: str, text: str) -> float:
    q_terms = [t for t in _tokenize(query) if t not in _STOPWORDS]
    t_terms = _tokenize(text)
    if not q_terms or not t_terms:
        return 0.0

    term_freqs: dict[str, int] = {}
    for term in t_terms:
        term_freqs[term] = term_freqs.get(term, 0) + 1

    doc_len = len(t_terms)
    avg_doc_len = 250.0  # rough average assumption
    k1, b = 1.5, 0.75
    score = 0.0
    for term in q_terms:
        freq = term_freqs.get(term, 0)
        if freq == 0:
            continue
        # Saturate term frequency.
        saturated = 1.0 + math.log(1.0 + math.log(freq + 1.0))
        denom = saturated + k1 * (1.0 - b + b * doc_len / avg_doc_len)
        score += saturated / denom
    # Normalise by query length.
    return min(score / len(q_terms), 1.0)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _chunk_text(chunk: PendingChunk) -> str:
    return f"{chunk.sourceName} — {chunk.sectionTitle} — {chunk.entryLabel}\n{chunk.text}"


def chunk_pack(pack: AnalysisPack, doc_type: RagDocType) -> list[PendingChunk]:
    source_slug = slugify(pack.name)
    chunks: list[PendingChunk] = []

    if pack.tldr:
        chunks.append(
            PendingChunk(
                id=f"{doc_type}-{source_slug}-tldr",
                docType=doc_type,
                sourceName=pack.name,
                sectionTitle="TL;DR",
                entryLabel="TL;DR",
                text=pack.tldr,
            )
        )

    for section in pack.sections:
        for entry in section.entries or []:
            chunks.append(
                PendingChunk(
                    id=f"{doc_type}-{source_slug}-{slugify(f'{section.id}-{entry.label}')}",
                    docType=doc_type,
                    sourceName=pack.name,
                    sectionTitle=section.title,
                    entryLabel=entry.label,
                    text=_entry_text(entry),
                )
            )
        for episode in section.episodes or []:
            text = _episode_text(episode)
            if not text:
                continue
            chunks.append(
                PendingChunk(
                    id=f"{doc_type}-{source_slug}-{slugify(f'{section.id}-{episode.title}')}",
                    docType=doc_type,
                    sourceName=pack.name,
                    sectionTitle=f"{section.title} · {episode.title}",
                    entryLabel=episode.title,
                    text=text,
                )
            )
    return chunks


def _entry_text(entry: PackEntry) -> str:
    from app.services.pack_service import pack_entry_text

    return pack_entry_text(entry)


def _episode_text(episode: PackEpisode) -> str:
    parts = [f"{entry.label}\n{_entry_text(entry)}" for entry in episode.entries]
    return "\n\n".join(part for part in parts if part)


def chunk_markdown(
    title: str,
    markdown: str,
    doc_type: RagDocType = "altitut",
) -> list[PendingChunk]:
    source_slug = slugify(title)
    chunks: list[PendingChunk] = []

    # Split by level-2 headings.
    sections = re.split(r"\n##\s+", markdown)
    for section in sections:
        section = section.strip()
        if not section:
            continue
        lines = section.splitlines()
        heading = lines[0].strip().lstrip("#").strip() if lines else "Overview"
        body = "\n".join(lines[1:]).strip()
        if not body:
            continue

        # Paragraph-based chunks up to 2400 chars.
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
        current = ""
        for paragraph in paragraphs:
            if len(current) + len(paragraph) > 2400 and current:
                chunks.append(
                    PendingChunk(
                        id=f"{doc_type}-{source_slug}-{slugify(heading)}-{len(chunks)}",
                        docType=doc_type,
                        sourceName=title,
                        sectionTitle=heading,
                        entryLabel=f"section-{len(chunks)}",
                        text=current.strip(),
                    )
                )
                current = paragraph
            else:
                current += "\n\n" + paragraph if current else paragraph
        if current.strip():
            chunks.append(
                PendingChunk(
                    id=f"{doc_type}-{source_slug}-{slugify(heading)}-{len(chunks)}",
                    docType=doc_type,
                    sourceName=title,
                    sectionTitle=heading,
                    entryLabel=f"section-{len(chunks)}",
                    text=current.strip(),
                )
            )
    return chunks


def ingest_chunks(pending: list[PendingChunk]) -> int:
    if not pending:
        return 0

    texts = [_chunk_text(c) for c in pending]
    embeddings = embed_texts(texts)

    batch = db.batch()
    for chunk, vector in zip(pending, embeddings, strict=False):
        data = chunk.model_dump(mode="json")
        data["embedding"] = vector
        ref = db.collection(COLLECTIONS["ragChunks"]).document(chunk.id)
        batch.set(ref, data)
    batch.commit()

    _cache["chunks"] = None  # invalidate
    _cache["loaded_at"] = 0.0
    return len(pending)


def ingest_pack(pack: AnalysisPack, doc_type: RagDocType) -> int:
    pending = chunk_pack(pack, doc_type)
    return ingest_chunks(pending)


def remove_pack_chunks(source_name: str) -> None:
    docs = db.collection(COLLECTIONS["ragChunks"]).where("sourceName", "==", source_name).stream()
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()
    _cache["chunks"] = None
    _cache["loaded_at"] = 0.0


def _load_chunks() -> list[RagChunk]:
    now = time.time()
    cached = _cache.get("chunks")
    if cached is not None and (now - _cache["loaded_at"]) < CACHE_TTL_SECONDS:
        return cached  # type: ignore[return-value]

    chunks: list[RagChunk] = []
    for doc in db.collection(COLLECTIONS["ragChunks"]).stream():
        data = doc.to_dict()
        if not data or not data.get("embedding"):
            continue
        data["id"] = doc.id
        try:
            chunks.append(RagChunk.model_validate(data))
        except Exception:
            continue
    _cache["chunks"] = chunks
    _cache["loaded_at"] = now
    return chunks


def hybrid_retrieve(
    query_text: str,
    top_k: int = 12,
    doc_types: list[RagDocType] | None = None,
) -> list[RetrievedChunk]:
    if not query_text.strip():
        return []

    chunks = _load_chunks()
    query_embedding = embed_texts([query_text])[0]
    query_vec = np.array(query_embedding)
    query_lower = query_text.lower()

    results: list[RetrievedChunk] = []
    for chunk in chunks:
        if doc_types and chunk.docType not in doc_types:
            continue

        dense = _cosine_similarity(query_vec, np.array(chunk.embedding))
        chunk_text = _chunk_text(
            PendingChunk(
                id=chunk.id,
                docType=chunk.docType,
                sourceName=chunk.sourceName,
                sectionTitle=chunk.sectionTitle,
                entryLabel=chunk.entryLabel,
                text=chunk.text,
            )
        )
        lexical = _lexical_score(query_text, chunk_text)
        name_boost = 0.15 if chunk.sourceName.lower() in query_lower else 0.0
        score = 0.6 * dense + 0.4 * lexical + name_boost

        results.append(
            RetrievedChunk(
                id=chunk.id,
                docType=chunk.docType,
                sourceName=chunk.sourceName,
                sectionTitle=chunk.sectionTitle,
                entryLabel=chunk.entryLabel,
                text=chunk.text,
                score=score,
            )
        )

    results.sort(key=lambda c: c.score, reverse=True)
    return results[:top_k]
