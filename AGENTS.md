# Agent Instructions

Read this file first. It is the single entry point for any AI coding agent
(Claude Code, Cursor, Codex, etc.) working in this repository. `CLAUDE.md`
redirects here.

## What this repository is

This repo is the **Social Media Command Center for Altitut** — an internal
dashboard where the Altitut team will:

1. **Track competitor insights** — what competitors are doing on social media,
   how they position themselves, and what the team can learn from it.
2. **Generate and manage content-creation ideas** — a pipeline of social media
   content ideas for promoting Altitut's products.

The repo is currently a **blank slate** (reset on 2026-07-09 for a fresh
build). There is no product code yet — do not be surprised by the empty tree,
and do not assume the project is undefined; the product intent above is the
spec so far.

## Who Altitut is (company context)

Altitut is an **entrepreneurship-education platform** that teaches students and
early founders how to build a startup — idea discovery, customer interviews,
MVP building, pitching, and funding applications. It ships one shared platform
(Firebase auth/data + a FastAPI backend + AI features) through **two products**:

- **Altitut Web App** — a React 19 "startup operating system" / LMS where
  founders do the real work: Home dashboard, Course (class/LMS layer for
  instructors), My Startup profile builder, Funding discovery, Pitch toolkit
  (review / craft / practice), Learning curriculum, Interviews hub, MVP
  builders, Ikigai idea discovery, Personas, and Profile.
- **Altitut Game** — a Phaser 3 pixel-art RPG that teaches the same curriculum
  through play: a Garage hub, Startup City, a Pitch Arena, and four themed
  skill worlds (Spark, Forge, Vault, Summit) with mini-games, a coin/XP
  economy, pets, leaderboards, and an AI mentor ("Alti").

Both products share accounts, backend, and curriculum — one platform, two
clients. The **full product overview lives at
[docs/ALTITUT-PRODUCT-OVERVIEW.md](./docs/ALTITUT-PRODUCT-OVERVIEW.md)** — read
it when a task depends on understanding Altitut's products, audience
(students, founders, instructors), or feature set (e.g. when deciding who
Altitut's competitors are or what content to promote).

## Before assuming code doesn't exist

A previous version of this project (a social media analysis platform with a
Python backend, React frontend, and data connectors) was **archived, not
deleted**, when the repo was reset. If asked about prior functionality, past
implementations, or "how did this used to work," read
**[GUIDE_FOR_ARCHIVED_CODE.md](./GUIDE_FOR_ARCHIVED_CODE.md)** first. In
short: the old codebase is browsable as plain files at
`../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1` and permanently tagged as
`archive-v1` in git.

## Stack & setup

The app is a **Next.js (App Router) + TypeScript + Tailwind CSS 3.4** webapp at
the repo root, styled to the Altitut design system (Inter/Montserrat via
`next/font`, brand tokens in `tailwind.config.js`, utilities in
`app/globals.css` — see `resources/DESIGN_GUIDE.md` and
`resources/DESIGN_GUIDE_P2.md`). Layout: white header (title + "Help ?"),
a side nav with two tabs (Competitors Analysis, Content Creation), and a
content pane.

- `npm install` — install dependencies
- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build and serve
- `npm run seed` — (re)ingest predefined competitor/content packs + RAG chunks
  (including the platform guide) into Firestore
- `npm run telegram:webhook -- <https-url>` — register the Telegram bot webhook
- `npm run test:autopost` — regression tests for the Upload-Post adapter (mocks
  the Upload-Post API and exercises response parsing / status polling).

### Feature map (added 2026-07)

- **Data & persistence** — Firestore project `altitut-sma-dashboard`
  (`lib/firebase.ts`, open rules). Collections: `competitors`, `contentPacks`
  (both rendered live via `onSnapshot` in `app/page.tsx`, with the static packs
  in `data/` as fallback), `ragChunks` (vector store), `scoutRuns`,
  `telegramUpdates`. Pack CRUD + model-output normalization: `lib/packs.ts`.
- **Competitor Scout** (`app/components/scout-dialog.tsx`, `app/api/scout/route.ts`,
  `lib/scout.ts`) — client-driven 8-step workflow: Exa company discovery → site
  crawl → social mapping (Apify Instagram profile scrape + Exa) → deep research →
  three GPT synthesis passes producing the exact 8-section competitor-pack
  structure (`resources/competitor_pack_structure`) + TL;DR → save to Firestore
  + RAG ingest.
- **Competitor chatbot** (`app/components/chat-panel.tsx`, `app/api/chat/route.ts`,
  `lib/rag.ts`) — hybrid RAG (OpenAI `text-embedding-3-small` @512 dims cosine +
  lexical scoring) over all packs + `docs/ALTITUT-PRODUCT-OVERVIEW.md`; streams
  via Vercel AI SDK (`useChat`), renders markdown with react-markdown.
- **Help / platform guide** (`app/components/help-dialog.tsx`,
  `app/api/help-chat/route.ts`, `lib/platform-guide.ts`, `docs/PLATFORM-GUIDE.md`)
  — **Help ?** opens a guide + help assistant. Help chat RAG is scoped to
  `docType: "platform-guide"` chunks (auto-ingested on first ask if missing).
- **Telegram content-pack bot** (`app/api/telegram/route.ts`, `lib/telegram.ts`,
  `lib/reel.ts`) — reel link → Apify `instagram-scraper` → Whisper transcript →
  vision-grounded reel-analysis pass (frames as base64 data URLs; produces a
  "1. UNDERSTANDING THE REEL" section + an observed-facts sheet) → two-pass GPT
  synthesis of the transfer plan (sections 2–6, the classic
  `resources/content_pack_structure`, hard-grounded in the observed facts so
  visual/audio/caption recipes mirror the real reel) → Firestore + RAG. Needs
  `TELEGRAM_BOT_TOKEN` (see `SETUP_NEEDED_FROM_YOU.md`).
- **Auto-Post** (`app/components/autopost-*.tsx`, `app/api/autopost/route.ts`,
  `app/api/autopost/accounts/route.ts`, `app/api/autopost/caption/route.ts`,
  `lib/social-posts.ts`, `lib/social/accounts.ts`, `lib/storage.ts`, `lib/social/*`)
  — a four-step composer that uploads media directly to Firebase Storage, writes
  AI-generated per-platform copy, and publishes to LinkedIn, Facebook and
  Instagram through Upload-Post. Also exposed as a **Post** button on each
  content pack in `app/components/pack-panel.tsx`; the pack is flattened into
  ground truth (`lib/packs.ts` helpers) and fed to the caption generator, so
  platforms, placement, hashtags and descriptions are pre-built from the pack.
  Gracefully skips any platform that is not connected and still publishes the
  rest. Setup: `AUTOPOST_SETUP.md`. Needs `UPLOAD_POST_API_KEY`,
  `UPLOAD_POST_PROFILE` and open Firebase Storage rules.
- **Connectors** — `lib/exa.ts` (search/contents), `lib/apify.ts` (actor runs),
  `lib/openai.ts` (chat-JSON with retry, embeddings), `lib/altitut.ts` (product
  context constants).

## FastAPI backend

The backend is being migrated from Next.js API routes to a FastAPI service in
`backend/`. It currently mirrors the original pipelines and will receive Redis
job queues and GitHub Actions CI/CD next.

- Entry point: `backend/app/main.py` (`uvicorn app.main:app` from `backend/`).
- Routers: `backend/app/api/routers/{competitors,content_packs,chat,help,scout,telegram,autopost}.py`.
- Services: `backend/app/services/{openai_client,exa_client,apify_client,pack_service,rag_service,scout_service,reel_service,caption_service,autopost_service}.py` plus `backend/app/services/social/` for Upload-Post.
- Dependencies managed with `uv` (`backend/pyproject.toml`).
- To run: `cd backend && uv sync && uvicorn app.main:app --reload`.
- `.env` stays at repo root; `backend/app/config.py` loads it.

## Working notes

- `.env` / `.env.example` at the repo root carry the credentials (OpenAI, Exa,
  Apify, Telegram); `.env` is gitignored — never commit it. API routes that run
  long declare `maxDuration = 300` for Vercel Fluid Compute.
- If you materially change the stack or add tooling, update the section above
  so the next agent isn't left guessing.
