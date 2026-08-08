"""FastAPI entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import autopost, chat, competitors, content_packs, help, scout, telegram
from app.api.trace import TRACE_ID_HEADER, setup_traceability

app = FastAPI(title="Altitut SMA API", version="0.1.0")

setup_traceability(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[TRACE_ID_HEADER],
)

app.include_router(competitors.router, prefix="/api/competitors", tags=["Competitors"])
app.include_router(content_packs.router, prefix="/api/content-packs", tags=["Content Packs"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(help.router, prefix="/api/help", tags=["Help"])
app.include_router(scout.router, prefix="/api/scout", tags=["Scout"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["Telegram"])
app.include_router(autopost.router, prefix="/api/autopost", tags=["Auto-Post"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
