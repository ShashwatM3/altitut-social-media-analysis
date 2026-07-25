"""Competitor chatbot (hybrid RAG + streaming)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models import ChatRequest
from app.services.openai_client import get_client
from app.services.rag_service import hybrid_retrieve
from app.shared.altitut_context import ALTITUT_CHAT_CONTEXT

router = APIRouter()


def _last_user_text(request: ChatRequest) -> str:
    for msg in reversed(request.messages):
        if msg.role == "user":
            return " ".join(p.text for p in msg.parts if p.type == "text")
    return ""


def _format_chunks(chunks: list) -> str:
    lines = []
    for c in chunks:
        lines.append(f"Source: {c.sourceName} / {c.sectionTitle} / {c.entryLabel}\n{c.text}")
    return "\n\n---\n\n".join(lines)


def _stream_chat(request: ChatRequest):
    query = _last_user_text(request)
    chunks = hybrid_retrieve(query, top_k=12) if query.strip() else []
    context = _format_chunks(chunks)

    system = (
        f"{ALTITUT_CHAT_CONTEXT}\n\n"
        "You are a competitive-intelligence assistant inside the Altitut dashboard. "
        "Answer using the retrieved competitor packs and Altitut product overview below. "
        "Cite which competitor/source you are drawing from. Be honest when the retrieval does not answer the question. "
        "Respond in normal text (no JSON).\n\n"
        f"=== RETRIEVED CONTEXT ===\n{context}"
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


@router.post("")
def chat(request: ChatRequest):
    return _stream_chat(request)
