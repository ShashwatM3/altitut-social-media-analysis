"""Platform-guide chatbot (scoped RAG)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models import ChatRequest
from app.services.openai_client import get_client
from app.services.rag_service import chunk_markdown, hybrid_retrieve, ingest_chunks
from app.shared.altitut_context import ALTITUT_CHAT_CONTEXT

router = APIRouter()

_GUIDE_PATH = Path(__file__).resolve().parents[4] / "docs" / "PLATFORM-GUIDE.md"


def _last_user_text(request: ChatRequest) -> str:
    for msg in reversed(request.messages):
        if msg.role == "user":
            return " ".join(p.text for p in msg.parts if p.type == "text")
    return ""


def _ensure_guide_ingested() -> None:
    if hybrid_retrieve("what is altitut", top_k=1, doc_types=["platform-guide"]):
        return
    if not _GUIDE_PATH.exists():
        return
    markdown = _GUIDE_PATH.read_text(encoding="utf-8")
    pending = chunk_markdown("Altitut Platform Guide", markdown, doc_type="platform-guide")
    ingest_chunks(pending)


def _format_chunks(chunks: list) -> str:
    lines = []
    for c in chunks:
        lines.append(f"{c.sectionTitle} / {c.entryLabel}\n{c.text}")
    return "\n\n---\n\n".join(lines)


@router.post("")
def help_chat(request: ChatRequest):
    _ensure_guide_ingested()
    query = _last_user_text(request)
    chunks = hybrid_retrieve(query, top_k=10, doc_types=["platform-guide"]) if query.strip() else []
    context = _format_chunks(chunks)

    system = (
        f"{ALTITUT_CHAT_CONTEXT}\n\n"
        "You are the Altitut platform-help assistant. Answer questions about how to use the Altitut Social Media Command Center and the platform itself, using the platform guide below. "
        "If the guide does not contain the answer, say so honestly and suggest contacting the team. "
        "Respond in normal text (no JSON).\n\n"
        f"=== PLATFORM GUIDE ===\n{context}"
    )

    messages = [{"role": "system", "content": system}]
    for msg in request.messages:
        text = " ".join(p.text for p in msg.parts if p.type == "text")
        if text.strip():
            messages.append({"role": msg.role, "content": text})

    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,  # type: ignore[arg-type]
        stream=True,
    )

    def generator():
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield f"data: {delta}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generator(), media_type="text/event-stream")
