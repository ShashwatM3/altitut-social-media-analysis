# Altitut Social Media Command Center — Complete Technical & Product Deep Dive

> **Purpose of this document:** This is not a summary. It is a complete, no-gaps technical and product understanding of this codebase — how everything works end to end, why it was built the way it was, and how every pipeline connects. Intended as authoritative context for any LLM, technical reviewer, or new engineer working on this project.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Company & Product Context — Who Is Altitut?](#2-company--product-context--who-is-altitut)
3. [The System at a Glance — Architecture Overview](#3-the-system-at-a-glance--architecture-overview)
4. [Tech Stack — Every Layer Explained](#4-tech-stack--every-layer-explained)
5. [Data Model — How Information Is Shaped](#5-data-model--how-information-is-shaped)
6. [Firestore Schema — Collections and Documents](#6-firestore-schema--collections-and-documents)
7. [Feature 1: Competitor Scout](#7-feature-1-competitor-scout)
8. [Feature 2: Competitor RAG Chatbot](#8-feature-2-competitor-rag-chatbot)
9. [Feature 3: Content Packs — The Telegram Bot Pipeline](#9-feature-3-content-packs--the-telegram-bot-pipeline)
10. [Feature 4: Auto-Post — Publishing to Social Media](#10-feature-4-auto-post--publishing-to-social-media)
11. [Feature 5: Help Guide & Platform Assistant](#11-feature-5-help-guide--platform-assistant)
12. [The RAG Engine — Shared Infrastructure](#12-the-rag-engine--shared-infrastructure)
13. [Request Tracing — Error Traceability System](#13-request-tracing--error-traceability-system)
14. [Frontend Architecture — How the UI Is Built](#14-frontend-architecture--how-the-ui-is-built)
15. [Backend Architecture — FastAPI Service](#15-backend-architecture--fastapi-service)
16. [External API Integrations](#16-external-api-integrations)
17. [Design System](#17-design-system)
18. [Seeding & Static Data](#18-seeding--static-data)
19. [Git History — How the Project Evolved](#19-git-history--how-the-project-evolved)
20. [Configuration, Secrets, and Environment](#20-configuration-secrets-and-environment)
21. [Scripts and Tooling](#21-scripts-and-tooling)

---

## 1. What This Project Is

The **Altitut Social Media Command Center** is an internal dashboard built for the Altitut team. It has three distinct purposes, each exposed as a tab in the UI:

**1. Competitors Analysis** — A structured intelligence system for tracking what competitors are doing on social media. Each competitor is represented as a rich "analysis pack" — an 8-section structured document covering identity, product, social presence, content strategy, top-performing posts, paid campaigns, audience sentiment, and a synthesis verdict. These packs are generated automatically by an AI-driven pipeline called **Competitor Scout** and stored in Firestore. A RAG-powered chatbot allows the team to ask questions across all competitor packs in natural language.

**2. Content Creation** — A content production pipeline where every "content pack" is a repeatable, produceable social media series modeled after a real Instagram reel that has already proven to work. The team (or Telegram bot) feeds a viral reel URL; the system scrapes it, transcribes it, analyzes every frame visually using GPT-4 vision, and produces a transferable series plan tailored to Altitut's audience and products. Each content pack contains an episode plan (3 specific episodes ready to film), a recipe (camera direction, audio, caption templates), and execution notes.

**3. Auto-Post** — A four-step composer for publishing media posts directly to LinkedIn, Facebook, and Instagram through a third-party API called Upload-Post. The team uploads a video or images directly to Firebase Storage, the AI generates platform-tailored captions, and the system handles the entire publish-poll-save lifecycle.

This is entirely an **internal tool** — no end-user login, no multi-tenant concerns. It is the Altitut social media team's operating system for competitor intelligence and content execution.

---

## 2. Company & Product Context — Who Is Altitut?

Altitut is an **entrepreneurship-education platform** that teaches students and early-stage founders how to build a startup. The company ships one unified backend (Firebase + FastAPI) through two distinct client products:

### Altitut Web App
A React 19 "startup operating system" / LMS. Its features include:
- **Home dashboard** — progress tracking, badges, startup health score
- **Course** — a class/LMS layer where instructors run cohorts with gradebooks
- **My Startup** — structured profile builder for a founder's startup
- **Funding discovery** — AI-matched funding opportunities
- **Pitch toolkit** — AI deck review, guided crafting, practice recordings
- **Learning curriculum** — structured knowledge modules
- **Interviews hub** — customer interview tooling with AI transcription and insight extraction
- **MVP builders** — AI mockups, prototypes, GitHub scaffolds
- **Ikigai idea discovery** — guided framework for idea generation
- **Personas** — audience persona builder

### Altitut Game
A Phaser 3 pixel-art RPG that teaches the same curriculum through play:
- **Garage hub** — the player's home base
- **Startup City** — the game world
- **Pitch Arena** — pitch practice as gameplay
- **Four skill worlds** — Spark (ideation), Forge (product), Vault (finance), Summit (growth)
- **AI mentor "Alti"** — guides the player
- **XP/coin economy, pets, leaderboards**

### Social Media Context
Altitut is in an early growth phase (~700–1,000 users at the time of this writing) and is just beginning to build a consistent social media presence. The Social Media Command Center is the internal tool for understanding the competitive landscape and executing a content strategy systematically.

---

## 3. The System at a Glance — Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (User)                          │
│  Next.js 15 App Router SPA — http://localhost:3000              │
│  Three tabs: Competitors Analysis | Content Creation | Auto-Post │
└───────────────────────────────┬─────────────────────────────────┘
                                │  HTTP/SSE  (NEXT_PUBLIC_API_BASE_URL)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend — http://127.0.0.1:8000         │
│  /api/competitors  /api/content-packs  /api/chat  /api/help     │
│  /api/scout  /api/telegram  /api/autopost                       │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   Firestore   OpenAI     Exa AI    Apify     Upload-Post
   (Firebase)  GPT-4o-mini web search  Instagram  (social publish)
               Whisper    + contents  scraper
               embedding
```

The frontend is a Next.js 15 single-page application. It communicates exclusively with the FastAPI backend (no Next.js API routes remain — they were removed in commit `8aae317`). The backend in turn calls four external services:

- **Firebase Firestore** — the single source of truth for all data (competitor packs, content packs, RAG chunks, post history, Telegram deduplication)
- **OpenAI** — GPT-4o-mini for all JSON synthesis, GPT-4 vision for reel analysis, Whisper for transcription, `text-embedding-3-small` for RAG embeddings
- **Exa AI** — semantic web search and page content extraction for competitor research
- **Apify** — Instagram profile and post scraping
- **Upload-Post** — third-party social media publishing API for LinkedIn, Facebook, and Instagram

Firebase Storage is used directly from the browser (the frontend uploads media files, obtains public URLs, and passes them to the backend — the backend never proxies raw media bytes).

---

## 4. Tech Stack — Every Layer Explained

### Frontend

| Technology | Version | Role |
|---|---|---|
| Next.js | 15.3.4 (App Router) | SPA framework, routing, SSR disabled via `"use client"` |
| TypeScript | 5.x | Type safety throughout |
| Tailwind CSS | 3.4.19 | All styling via utility classes |
| React | 19.0.0 | UI rendering |
| Firebase JS SDK | 12.16.0 | Firestore real-time listeners + Storage uploads |
| react-markdown + remark-gfm | 10.1.0 / 4.0.1 | Render markdown in chat responses |

There is no state management library (no Redux, no Zustand). State is local React state (`useState`, `useRef`, `useMemo`) plus Firestore's real-time `onSnapshot` subscription for live data.

### Backend

| Technology | Version | Role |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.115.0+ | API framework |
| Uvicorn | 0.30.0+ | ASGI server |
| Pydantic v2 | 2.9.0+ | Request/response validation and serialization |
| pydantic-settings | 2.5.0+ | Environment variable loading into a typed `Settings` object |
| httpx | 0.27.0+ | HTTP client for all external API calls |
| openai | 1.42.0+ | OpenAI Python SDK |
| firebase-admin | 6.5.0+ | Firestore Admin SDK (server-side reads/writes) |
| numpy | 1.26.0+ | Vector math for cosine similarity in RAG |
| uv | — | Dependency management (replaces pip/poetry) |

### Infrastructure

| Service | Project | Role |
|---|---|---|
| Firebase Firestore | `altitut-sma-dashboard` | Primary database (open rules) |
| Firebase Storage | `altitut-sma-dashboard.firebasestorage.app` | Media file hosting |
| OpenAI API | — | GPT-4o-mini, GPT-4 vision, Whisper, text-embedding-3-small |
| Exa AI | — | Neural web search + live page crawl |
| Apify | — | Instagram profile + post scraping (`apify/instagram-profile-scraper`, `apify/instagram-scraper`) |
| Upload-Post API | — | Social media publishing (LinkedIn, Facebook, Instagram) |
| Telegram Bot API | — | Inbound reel links via Telegram webhook |
| Mintlify | `altitut-sma.mintlify.app` | Public documentation site |

---

## 5. Data Model — How Information Is Shaped

The central data structure is `AnalysisPack`. Both competitor packs and content packs use the same schema, just with different section IDs and titles.

### AnalysisPack (and StoredPack)

```
AnalysisPack
├── name: string                    — e.g. "Fe/male Switch", "Founder's Journey Series"
├── tag: string                     — short label, e.g. "High Similarity", "Pack 01"
├── meta: string                    — one-line descriptor, e.g. "Tier 1 competitor"
│                                     or "45–90s Reel · IG / TikTok / Shorts"
├── links?: PackLinks               — social profile URLs
│   ├── website?: string
│   ├── instagram?: string
│   ├── linkedin?: string
│   └── twitter?: string
├── referenceReels?: string[]       — Instagram reel URLs (content packs only)
├── tldr?: string                   — 4-5 line executive summary (competitor packs only)
└── sections: PackSection[]         — the actual content

StoredPack extends AnalysisPack with:
├── id: string                      — Firestore document ID (slugified name)
├── source: "seed" | "competitor-scout" | "telegram-bot"
└── createdAt: string               — ISO timestamp
```

### PackSection

Every section has an `id` (machine-readable slug), a `title` (human-readable), and either `entries` or `episodes` (content packs use episodes for the series plan section, competitor packs use entries throughout).

```
PackSection
├── id: string                      — e.g. "identity", "product", "recipe", "series"
├── title: string                   — e.g. "1. IDENTITY", "5. THE RECIPE → HOW TO MAKE"
├── entries?: PackEntry[]           — used in most sections
└── episodes?: PackEpisode[]        — used in the "series" section of content packs
```

### PackEntry

An entry is a labeled block of structured content. The `label` identifies what this entry covers (e.g., "1.1 Snapshot", "4.3 Hook Patterns"). The `blocks` array is a typed union of three block types that the UI knows how to render differently:

```
PackEntry
├── label: string                   — e.g. "1.1 Snapshot", "5.2 Visual Style"
└── blocks: ContentBlock[]

ContentBlock (discriminated union):
├── { type: "paragraph", text: string }
│     — A plain prose paragraph
├── { type: "bullets", items: string[] }
│     — An unordered list of 3–7 specific fact bullets
└── { type: "labeled", label: string, items: string[] }
      — A labeled group (e.g. "Primary buyers: - ...")
```

This three-way block type is important: the AI synthesis prompts explicitly instruct GPT to produce one of these exact types, the backend validates and normalizes the output (`normalize_block()`), and the frontend renders them differently (paragraphs as `<p>`, bullets as `<ul>`, labeled groups as `<div>` with a bold label heading).

### PackEpisode (content packs only)

```
PackEpisode
├── title: string                   — e.g. "Episode 1 — The Validation Moment"
└── entries: PackEntry[]            — e.g. labels: "4.1.1 Title / Angle", "4.1.2 Hook", etc.
```

### Section Order Canonical

Both pack types share the same section ordering system defined in `pack_service.py`:

```python
SECTION_ORDER = [
    "understanding-the-reel",   # Content packs: section 1 (reel analysis)
    "identity",                  # Competitor packs: section 1
    "product",                   # Competitor packs: section 2
    "social",                    # Competitor packs: section 3
    "content",                   # Competitor packs: section 4
    "top-performers",            # Competitor packs: section 5
    "paid",                      # Competitor packs: section 6
    "audience",                  # Competitor packs: section 7
    "synthesis",                 # Competitor packs: section 8
    "overview",                  # Content packs: section 2
    "strategy",                  # Content packs: section 3
    "series",                    # Content packs: section 4 (episodes)
    "recipe",                    # Content packs: section 5
    "execution",                 # Content packs: section 6
]
```

---

## 6. Firestore Schema — Collections and Documents

Firebase project: `altitut-sma-dashboard`

### `competitors` collection
Each document is a `StoredPack` for a competitor. Document ID = slugified competitor name (e.g., `female-switch`, `strategyzer`). Seeded from `data/competitor-packs/*.json` via `npm run seed`, appended to by Competitor Scout.

### `contentPacks` collection
Each document is a `StoredPack` for a content series. Document ID = slugified series name. Seeded from `data/content-packs.ts`, appended to by the Telegram bot.

### `ragChunks` collection
Each document is a `RagChunk` — a text chunk with its vector embedding:
```
{
  id: string,           — e.g. "competitor-female-switch-identity-11-snapshot"
  docType: string,      — "competitor" | "content-pack" | "altitut" | "platform-guide"
  sourceName: string,   — e.g. "Fe/male Switch"
  sectionTitle: string, — e.g. "1. IDENTITY"
  entryLabel: string,   — e.g. "1.1 Snapshot"
  text: string,         — the full text of the entry
  embedding: float[]    — 512-dimensional vector from text-embedding-3-small
}
```
Document IDs are deterministic slugs computed from `docType + sourceName + sectionTitle + entryLabel`. This means re-ingesting a pack overwrites its chunks (idempotent update). The in-memory cache has a 120-second TTL to avoid hitting Firestore on every query.

### `scoutRuns` collection
Auto-appended by Scout after saving a competitor pack. Tracks when a scout ran, which competitor was found, and the scout's product description input.

### `telegramUpdates` collection
Used for deduplication: every processed Telegram update ID is stored here. Before processing any update, the bot checks if the document exists (already processed → skip).

### `socialPosts` collection
Each document is a `SocialPost` — the record of an auto-post job:
```
{
  id: string,           — UUID generated at compose time
  createdAt: string,
  status: string,       — "draft" | "publishing" | "published" | "partial" | "failed" | "scheduled"
  media: MediaInfo,
  brief: string,
  copy: { linkedin: PlatformCaption, facebook: PlatformCaption, instagram: PlatformCaption },
  targets: AutopostTarget[],
  scheduledFor?: string,
  timezone?: string,
  vendor: "upload_post",
  vendorRequestId?: string,
  jobId?: string,
  results: UploadPostResult[]
}
```

### `socialAccounts` collection
Cached resolved social accounts (one document per provider: `linkedin`, `facebook`, `instagram`). Populated by the `resolve_social_account()` function when it calls the Upload-Post API to check connection status.

---

## 7. Feature 1: Competitor Scout

### Purpose
The Competitor Scout finds, researches, and produces a structured 8-section analysis pack for one new competitor at a time. It is a **client-driven pipeline**: the frontend calls the backend one step at a time, passing a `ScoutState` object forward. This means the user can see progress in real time and retry individual steps on failure without restarting the entire workflow.

### Trigger
The user clicks **"Run Competitor Scout"** button in the Competitors Analysis tab, reviews/edits the pre-filled description of Altitut (from `lib/altitut.ts`), and clicks Submit. The workflow begins.

### The 8-Step Workflow

#### Frontend (`app/components/scout-dialog.tsx`)

The `RunCompetitorScout` component maintains:
- `phase`: `"idle" | "input" | "progress"` — controls which modal screen is shown
- `steps`: array of `{id, label, status: "pending"|"running"|"done"|"error"}` — drives the progress indicator
- `stateRef`: a `React.useRef` holding the accumulated `ScoutState` JSON, passed as the body to each step call
- `runFrom(index)`: async loop that iterates through all 8 steps sequentially, calling `POST /api/scout` with `{step: stepId, state: currentState}` and accumulating the returned state

Each step call:
```typescript
response = await fetch(api("/api/scout"), {
  method: "POST",
  headers: { "Content-Type": "application/json", [TRACE_ID_HEADER]: runTraceId },
  body: JSON.stringify({ step: step.id, state: stateRef.current })
});
```

If a step fails with a `TraceableError`, the step is marked "error", and a retry button appears. Retry resumes from the failed step index with the last known state.

#### Backend Router (`backend/app/api/routers/scout.py`)

Single endpoint `POST /api/scout` dispatches to step handlers:
```python
_STEP_HANDLERS = {
    "discover": step_discover,
    "website":  step_website,
    "social":   step_social,
    "research": step_research,
    "synthesize-identity": step_synthesize_identity,
    "synthesize-social":   step_synthesize_social,
    "synthesize-verdict":  step_synthesize_verdict,
}
```

The "save" step is handled inline in the router (not delegated to scout_service.py) because it involves Firestore writes.

#### Step 1: `discover` — Find the Best Untracked Competitor

**Input:** `productDescription` (Altitut's description), `existingNames` (already-tracked competitors)  
**Output:** `candidate: ScoutCandidate`, `alternates: [{name, website}]`

The discovery process is multi-layered and deliberate:

1. **Company search**: Runs 3 company-category Exa queries (e.g., "platforms similar to: [product description]", "gamified entrepreneurship education platform for students"). Up to 10 results per query, 1,200 char snippets.

2. **Article search**: Runs 3 article Exa queries (e.g., "best entrepreneurship education platforms roundup article") to find independent corroboration. Up to 5 results per query, 2,500 char snippets.

3. **Article extraction**: GPT extracts named companies from the articles that are genuinely described as products (not just mentioned in passing).

4. **Selection**: GPT receives both lists (company search results + article-extracted companies) and selects the single best NEW competitor not already in `existingNames`. Selection criteria: must match the entrepreneurship-education / startup-building space, strongly prefers companies appearing in BOTH lists (corroboration = real), excludes accelerators, VC funds, generic AI tools, publishers.

5. **Deduplication safety**: If the selected name fuzzy-matches an existing competitor, GPT's alternate list is used as a fallback.

**Why this design:** Two-list corroboration was introduced to prevent the scout from picking companies that merely appear in company search results but aren't real competitors (e.g., news sites, ad networks, unrelated SaaS tools that happen to come up in search).

#### Step 2: `website` — Crawl & Validate

**Input:** candidate from step 1  
**Output:** updated `candidate` (with verified social links), `websiteDigest`

1. **Relevance gate**: Fetches the candidate's homepage text via Exa `/contents`. Sends homepage text to GPT with a strict system prompt: "is_match is true ONLY if the homepage clearly shows a product in the same space." If false, tries the next alternate candidate from step 1's list (up to 3 candidates total). If all fail, the scout errors with a clear message.

2. **Product page crawl**: Exa search restricted to the candidate's domain for product/pricing/features pages (5 pages, 2,000 chars each).

3. **Social link extraction**: HTTP fetches the homepage HTML and regex-matches Instagram/LinkedIn/Twitter URLs (excluding share/intent links).

4. **Digest assembly**: Combines all crawled text into a `websiteDigest` string (capped at 12,000 chars) that all synthesis steps will reference.

#### Step 3: `social` — Map Social Presence

**Input:** candidate with website links  
**Output:** verified social links in candidate, `socialDigest`

This step builds a real social evidence dossier:

1. **Instagram**: If an Instagram URL was found on the website, or discovered via Exa search (`instagram.com` domain-restricted), the Apify `instagram-profile-scraper` actor is run synchronously. It returns followers, following count, post count, bio, external link in bio, and up to 6 latest post summaries (type, likes, comments, timestamp, caption snippet).

2. **LinkedIn / X / YouTube / TikTok**: Exa searches on each platform's domain to find the official profile. Pattern regex extracts the canonical URL.

3. **Profile verification**: ALL discovered profiles (with their evidence text) are sent to GPT in one call. The prompt is strict: a profile belongs to the company ONLY if its bio, display name, content, or linked website clearly matches. Similar-sounding handles don't count. The verifier returns `belongs: true/false` + reason for each profile URL.

4. **Digest assembly**: Verified profiles (with stats) and rejected profiles (with reason) are assembled into `socialDigest` (capped at 12,000 chars).

#### Step 4: `research` — Deep Research

**Input:** candidate, website/social digests  
**Output:** `researchDigest`

Four parallel Exa searches (sequential in code, but conceptually parallel):
- **NEWS & FUNDING**: news, funding, launch announcements (5 results)
- **REVIEWS & USER SENTIMENT**: G2, Capterra, Trustpilot, Reddit, ProductHunt (6 results)
- **CONTENT & MARKETING FOOTPRINT**: blog, series, social media posts (5 results)
- **PARTNERSHIPS, ADS & DISTRIBUTION**: partnership, ambassador, advertising programs (5 results)

All results assembled into `researchDigest` (capped at 16,000 chars, slightly higher limit because research needs more space).

#### Step 5: `synthesize-identity` — Sections 1–2

**Input:** all digests  
**Output:** sections array starts building with sections 1 (IDENTITY) and 2 (PRODUCT & WEBSITE)

GPT-4o-mini call with `response_format: {type: "json_object"}`. System prompt is `SYNTHESIS_SYSTEM` (senior competitive-intelligence analyst, exact JSON format required). User prompt includes all 4 digests + a precise instruction for exactly which sections and entries to produce.

Section 1 (IDENTITY):
- 1.1 Snapshot: one-liner, competitive tier, social reality
- 1.2 Positioning: value prop, differentiation from Altitut
- 1.3 Target Audience / ICP: labeled blocks for primary buyers, primary users, who they're NOT targeting
- 1.4 Similarity to Us: C1 (product similarity N/10), C2 (learning flow N/10), C3 (gamification N/10)

Section 2 (PRODUCT & WEBSITE):
- 2.1 Highlight Features
- 2.2 Most-Attractive Features
- 2.3 Messaging & Conversion (headline patterns, conversion funnel, social proof)
- 2.4 Insights to Imbibe (actionable takeaways for Altitut)

The response is validated with `_parse_sections()` — if it doesn't have at least 2 sections with the expected IDs, it errors and retries once with a JSON repair instruction appended.

**Token budget:** `max_output_tokens=8000` — these synthesis calls produce lengthy, detailed JSON.

#### Step 6: `synthesize-social` — Sections 3–5

**Input:** all digests + sections 1–2 already written  
**Output:** sections 3 (SOCIAL PRESENCE), 4 (CONTENT STRATEGY), 5 (TOP PERFORMERS) appended to sections array

Section 3 (SOCIAL PRESENCE): Per-platform entries with real numbers from scrape + research, explicitly noting "no verified presence found" when absent.

Section 4 (CONTENT STRATEGY): Content pillars, recurring series, hook patterns (with examples), CTA intent, brand voice, production style.

Section 5 (TOP PERFORMERS): Per-post teardowns with the repeatable formula.

#### Step 7: `synthesize-verdict` — Sections 6–8 + TL;DR

**Input:** all digests + sections 1–5 already written (summarized to 6,000 chars to stay within context)  
**Output:** sections 6 (PAID), 7 (AUDIENCE), 8 (SYNTHESIS), plus `tldr`, `tag`, `meta`

Section 6 (PAID & PARTNERSHIPS): Meta Ad Library evidence, partnership programs.

Section 7 (AUDIENCE & COMMUNITY): Expected praise/complaints, whitespace gaps, responsiveness, owned community.

Section 8 (SYNTHESIS): Winning formula, recent shifts, Steal/Avoid/Test (3 labeled blocks), hooks into content packs.

`tldr`: Two paragraphs separated by `\n\n` — who they are + tier, then social/content reality + the single clearest play for Altitut.  
`tag`: 1–3 word similarity label (e.g., "High Similarity", "Adjacent Player").  
`meta`: Tier label (e.g., "Tier 1 competitor").

#### Step 8: `save`

Handled directly in the router:
1. `assemble_pack(state)` — sorts all 8 sections by canonical order, validates exactly 8 are present, builds `AnalysisPack`
2. `save_pack(COLLECTIONS["competitors"], pack, "competitor-scout")` — writes to Firestore (document ID = slugified competitor name)
3. `ingest_pack(stored, "competitor")` — chunks the pack and embeds it into the RAG vector store
4. Writes a `scoutRun` audit record to Firestore
5. Returns `{state, pack}` — the frontend receives the `StoredPack` and shows the success banner

**Firestore real-time subscription** (`onSnapshot` in `app/page.tsx`) picks up the new competitor pack immediately without any page refresh.

---

## 8. Feature 2: Competitor RAG Chatbot

### Purpose
A conversational interface for the team to ask questions across all competitor packs in natural language. It answers questions like "Which competitor is the biggest threat?", "Compare Fe/male Switch and Startup Wars content strategies", "What content whitespace can Altitut own?".

### Architecture

**Frontend** (`app/components/chat-panel.tsx`):
- Uses `useStreamingChat` hook (`lib/use-chat.ts`), which manages a message history array, SSE reading, and status state
- Renders user messages (right-aligned teal bubble) and assistant messages (left-aligned, rendered as markdown via `react-markdown + remark-gfm`)
- Three suggestion chips pre-loaded in the empty state
- `POST /api/chat` with `{messages: [{role, parts: [{type:"text", text}]}]}`

**Backend** (`backend/app/api/routers/chat.py`):
1. Extracts the last user message text
2. Calls `hybrid_retrieve(query, top_k=12)` — the hybrid RAG retrieval (see Section 12)
3. Formats retrieved chunks as `Source: {sourceName} / {sectionTitle} / {entryLabel}\n{text}` blocks separated by `---`
4. Builds system prompt: `ALTITUT_CHAT_CONTEXT` + role description + "cite which competitor you're drawing from" + "be honest when retrieval doesn't answer" + retrieved context
5. Calls OpenAI `gpt-4o-mini` with `stream=True`
6. Returns `StreamingResponse` with `text/event-stream` media type, yielding `data: {chunk}\n\n` for each delta, ending with `data: [DONE]\n\n`

**`useStreamingChat` hook** (`lib/use-chat.ts`):
Manages SSE reading: reads from a `Response.body.getReader()`, accumulates incoming text, finds `data: ` prefixed lines, handles `[DONE]` termination. Maintains `status: "idle" | "submitted" | "streaming" | "complete"` and an `error` state.

The chat does **not** persist history across page refreshes (all state is in-memory React state). Each new message includes the full conversation history so GPT maintains context within a session.

---

## 9. Feature 3: Content Packs — The Telegram Bot Pipeline

### Purpose
The Telegram bot provides a frictionless input mechanism: the social media team sends a link to any viral Instagram reel → the system automatically builds a complete, production-ready content series pack tailored to Altitut.

### Trigger
The Telegram bot webhook (`backend/app/api/routers/telegram.py`) receives any message. If the message contains an Instagram reel URL (`/reel/`, `/reels/`, `/p/`, `/tv/` path patterns), the pipeline fires. Non-reel messages receive a help message back.

### Pipeline: `build_content_pack_from_reel()` (`backend/app/services/reel_service.py`)

#### Step 1: Scrape Reel Metadata (Apify)

`scrape_instagram_post(reel_url)` calls Apify's `apify/instagram-scraper` actor synchronously with `resultsType: "details"`. Returns:
- `caption` (verbatim post caption)
- `hashtags` (array)
- `ownerUsername`, `ownerFullName`
- `likesCount`, `commentsCount`, `videoPlayCount`, `videoViewCount`
- `videoDuration` (seconds)
- `timestamp` (ISO)
- `videoUrl` (direct MP4 URL, when available)
- `displayUrl` (thumbnail)
- `images` (for carousels)
- `musicInfo` → `{artist_name, song_name, uses_original_audio}`
- `productType` (REELS, CLIPS, etc.)

This data is normalized into a `ReelData` Pydantic model. Stats are extracted carefully with null handling (`_as_number()` excludes NaN).

Progress message sent to Telegram: "Scraped the reel by @{username} — {views} views, {likes} likes. Transcribing…"

#### Step 2: Transcribe Audio (Whisper)

`transcribe_reel(video_url)` downloads the MP4 from Apify's `videoUrl`:
- Rejects files > 24MB (Whisper API limit)
- Sends as `BytesIO` buffer named `reel.mp4` to `openai.audio.transcriptions.create(model="whisper-1")`
- Returns verbatim transcript or `None` if unavailable (private video, no audio URL, download failure)

Progress message: "Transcript captured. Analyzing the reel frame-by-frame…" (or variant if no transcript).

#### Step 3: Vision Analysis — `analyze_reel(reel, transcript)`

This is the most technically sophisticated step. The goal is to ground everything that follows in what the reel actually looks like, sounds like, and says.

1. **Frame extraction**: Up to 4 image URLs from `[reel.displayUrl, *reel.images[:3]]` are fetched and base64-encoded as data URLs (`data:image/jpeg;base64,...`). Files > 6MB are skipped. These are passed as image content parts to GPT-4 vision.

2. **GPT-4 vision analysis** (`complete_json()` with `images=[...]`): System prompt establishes a "forensic video analyst" who can ONLY state what is directly evidenced by transcript, caption, stats, and frames. "Not observable from available data" is the required phrase when something can't be determined. The prompt requests two outputs:
   - `"section"`: The "1. UNDERSTANDING THE REEL" section with entries:
     - 1.1 What Actually Happens (beat-by-beat from transcript with second-marks)
     - 1.2 The Hook (verbatim opening line + psychological devices)
     - 1.3 Structure & Strategy (narrative arc, retention devices, creator's strategic intent)
     - 1.4 Production Style (on-screen: talking head/photos/text overlays? audio: original voice/track? caption strategy)
     - 1.5 Why It Performed (ties real stats to specific craft choices)
   - `"observed_facts"`: A 10–15 line plain-text fact sheet of ONLY observable production facts (format, visual elements, text overlay style, audio reality, caption reality, hashtag reality, hook quote, duration, pacing, tone). Unobservable items prefixed with "UNKNOWN:".

3. The `observedFacts` sheet is the crucial output — it becomes the single source of truth for all downstream synthesis. The grounding rules (`_GROUNDING_RULES`) are non-negotiable:
   - The recipe must MIRROR the reel's actual observed style (if raw talking head with caption overlays, the recipe says raw talking head with caption overlays — not animations)
   - Never introduce music, graphics, or effects not observed in the reel
   - Any deviation must be explicitly flagged as "Deviation from the reference reel:"

Progress message: "Reel understood (hook, structure, production style). Building Altitut's content pack…"

#### Step 4: First Synthesis Pass — Sections 2–4 + meta

`synthesize_content_pack()` runs two GPT calls with the full `shared_context` (Altitut description + reel digest + observed facts) available:

**First call** produces:
- `name`: 2–4 word series name for Altitut's version of this format (not the creator's name)
- `meta`: format line like "45–90s Reel · IG / TikTok / Shorts"
- **Section 2 (OVERVIEW)**: 2.1 Series Name + Premise (one-line hook + what makes it a franchise), 2.2 Format & Platform (mirroring observed facts), 2.3 Origin (what the reference reel proves + why format fits Altitut)
- **Section 3 (STRATEGY)**: 3.1 What It Promotes (Altitut features this demos), 3.2 Goal (labeled: Primary/Secondary), 3.3 Who It's For
- **Section 5 (THE RECIPE → HOW TO MAKE)**: 5.1 Structure (hook→body→CTA with second-marks matching observed pacing), 5.2 Visual Style (MUST mirror observed on-screen reality), 5.3 Audio (MUST mirror observed audio), 5.4 Caption + Hashtags (starting from verbatim caption strategy, deviations flagged)
- **Section 6 (EXECUTION)**: 6.1 Cadence, 6.2 Roles & Effort, 6.3 What Good Looks Like

Validated with `_validate_plan()` — checks for all required section IDs.

#### Step 5: Second Synthesis Pass — Episode Plan

**Second call** produces Section 4 (THE SERIES → WHAT TO MAKE):
- `id: "series"`, `title: "4. THE SERIES → WHAT TO MAKE"`, `episodes: [...]`
- Exactly 3 episodes with:
  - 4.N.1 Title / Angle (specific content angle)
  - 4.N.2 Hook (spoken first line modeled on the reference reel's actual hook device + visual hook direction)
  - 4.N.3 What It Shows (beat-by-beat with rough second-marks matching observed pacing)
  - 4.N.4 CTA (consistent with reel's low-pressure style; if using comment-keyword funnel, flagged as deviation with one different keyword per episode)
- Episode 1 = Altitut's closest adaptation of the reference reel (same emotional register, same structure)
- Episodes 2–3 extend the franchise to other Altitut angles

Validated with `_validate_series()` — requires exactly 3 episodes.

#### Step 6: Assemble, Save, Respond

The 6 sections are assembled in canonical order:
```
[analysis.section, overview, strategy, series, recipe, execution]
= [1. UNDERSTANDING THE REEL, 2. OVERVIEW, 3. STRATEGY, 4. THE SERIES, 5. THE RECIPE, 6. EXECUTION]
```

`AnalysisPack` is built with `referenceReels=[reel.url]` so the UI shows the source reel link.

`save_pack(COLLECTIONS["contentPacks"], pack, "telegram-bot")` writes to Firestore.

`ingest_pack(stored, "content-pack")` indexes the pack in the RAG vector store.

Telegram message sent: `"Done! Built pack "{name}" ({id}).\n\nTL;DR:\n{tldr[:600]}"`.

**Firestore real-time subscription** in the frontend picks up the new content pack immediately.

---

## 10. Feature 4: Auto-Post — Publishing to Social Media

### Purpose
Publish videos or images simultaneously to LinkedIn, Facebook, and Instagram from a single four-step composer. Captions are AI-generated per platform. When opened from a content pack, captions are pre-generated using the pack as ground truth.

### The Four-Step Frontend Composer (`app/components/autopost-composer.tsx`)

The `AutoPostComposer` component renders a stepper with 4 steps: **Media → Destinations → Copy → Review & Publish**.

#### Step 1: Media

`MediaDropzone` component accepts drag-and-drop video or image uploads. Files are uploaded directly to Firebase Storage from the browser (not proxied through the backend). The upload uses `uploadBytesResumable()` and generates a `getDownloadURL()` public URL. Each file is tracked as a `MediaFile` with `{id, kind, url, path, status, width, height, durationSec, bytes}`.

**Why direct upload:** The backend never needs to handle large file transfers; it only receives public URLs. This avoids memory pressure and timeout issues for large videos.

A `ReelWarning` component checks whether the uploaded video meets Instagram Reels eligibility (aspect ratio 9:16, duration 3–90s). If not eligible, a gentle warning is shown (the post still publishes; it just won't appear in the Reels tab).

#### Step 2: Destinations

The user selects which platforms to post to (LinkedIn, Facebook, Instagram) and their placement (Feed, Reel, Story — where applicable). Platform connection status is fetched from `POST /api/autopost/accounts`, which calls `resolve_social_account()` on the backend — this in turn calls the Upload-Post API to check which accounts are connected. Platforms marked `needs_reauth` show an amber warning and will be skipped at publish time.

LinkedIn allows setting visibility (PUBLIC, CONNECTIONS, LOGGED_IN). Facebook and Instagram allow placement selection.

#### Step 3: Copy

Each selected platform gets a `PlatformCopyCard`. AI caption generation calls `POST /api/autopost/caption`:
```json
{
  "platforms": ["linkedin", "instagram"],
  "mediaKind": "video",
  "brief": "...",
  "tone": "professional",
  "mode": "generate",
  "packContext": "...flattened pack text (4000 chars)..."
}
```

Per-platform rules enforced by the caption service:
- **LinkedIn**: Professional, insight-led, max 3,000 chars, max 3 hashtags at end
- **Instagram**: Punchy, hook in first 125 chars, max 2,200 chars, hashtags stripped from caption into `firstComment`
- **Facebook**: Warm/conversational, community-oriented

If the composer was opened from a content pack (via the "Post" button in PackPanel), the pack's full text is passed as `packContext` so the AI generates captions that align with the pack's tone, hooks, and hashtag strategy. Captions are pre-generated immediately when `pack` prop is available.

The "Same copy everywhere" toggle syncs all platform captions to whatever is typed in any one card.

#### Step 4: Review & Publish

Shows media preview, destination summary, optional scheduling (datetime picker + timezone selector), and a **Publish** button. When published, a 4-step state machine runs:

```
validate → publish → poll → save
```

**validate step** (`validate_step()` in `autopost_service.py`):
- Checks `UPLOAD_POST_API_KEY` and `UPLOAD_POST_PROFILE` are configured
- Validates caption lengths (LinkedIn ≤ 3,000, Instagram ≤ 2,200)
- Resolves each platform account from Upload-Post API
- Marks `needs_reauth` platforms as `skipped` with a warning
- For Facebook: requires a connected Facebook Page; skips if none found
- Checks media URLs are reachable (HEAD request, fallback to GET for 405/5xx)
- Validates scheduled time is in the future and within 365 days

**publish step** (`publish_step()` / `publish_to_upload_post()`):

Calls the Upload-Post API with multipart/form-data. The endpoint depends on media kind:
- Video: `POST /upload`
- Images: `POST /upload_photos`
- Text-only: `POST /upload_text`

Key fields sent:
- `user`: the Upload-Post profile name
- `async_upload: "true"` — async processing
- `platform[]`: array of selected platforms
- Per-platform caption fields: `linkedin_description`, `instagram_title`, `facebook_title`
- Per-platform page IDs: `target_linkedin_page_id`, `facebook_page_id`
- Per-platform placement: `media_type` = REELS/STORIES/VIDEO for video posts, POSTS/STORIES for images
- Per-platform first comments: `linkedin_first_comment`, `instagram_first_comment`, `facebook_first_comment`
- Scheduling: `scheduled_date`, `timezone`

Response parsing is defensive — Upload-Post's API returns results in different shapes (array vs. dict). `_raw_results_to_array()` normalizes both shapes. `_map_raw_result()` maps status strings to the internal status enum (`"completed"/"success" → "success"`, `"pending"/"queued" → "pending"`, `"failed"/"error" → "failed"`). Multiple variant field names are tried for `platformPostId` and `postUrl`.

**poll step** (`poll_step()` / `check_upload_post_status()`):
- Polls `GET /uploadposts/status?job_id=...` or `?request_id=...` every 3 seconds
- Maximum 120 attempts (6 minutes)
- `done = true` when top-level status is "completed/failed/not_found" OR all individual platform results are in terminal states
- If timed out: marks as failed with informational message ("may still complete in background")

**save step** (`save_step()`):
- Writes `SocialPost` document to Firestore `socialPosts` collection

**delete step** (`delete_step()`):
- Calls `unpublish_on_upload_post()` for non-Instagram platforms with a `platformPostId`
- Deletes from Firestore

### Status computation

`_compute_status(results)`:
- All `success` → "published"
- All `failed/skipped` → "failed"
- Any `success` with some failures → "partial"
- Any `pending` → "publishing"

### Pack → AutoPost (the "Post" button on content packs)

Each content pack card has a **Post** button. Clicking it opens `AutoPostComposer` in a modal with `pack={packData}` prop. The composer:
1. Calls `derive_platforms_from_pack()` — scans pack text for "instagram/ig/reel/tiktok/youtube shorts", "facebook", "linkedin" mentions
2. Calls `derive_placement_from_pack()` — returns "reel" if "reel" appears, "story" if "story", else "feed"
3. Calls `packToBrief()` — extracts a one-line brief from TL;DR first sentence
4. Immediately calls caption generation with `packToGroundTruth()` (full pack text, 4,000 chars) as ground truth context
5. Pre-selects platforms and placement from the pack

There is also a backend endpoint `POST /api/autopost/from-pack?pack_id=...` that pre-builds an `AutopostState` from a pack, though it's currently not used by the frontend (the frontend does this derivation itself).

### Auto-Post History (`app/components/autopost-history.tsx`)

Reads from Firestore `socialPosts` collection with `onSnapshot` for live updates. Shows post status, per-platform results, and links to published posts.

---

## 11. Feature 5: Help Guide & Platform Assistant

### Purpose
The **Help ?** button in the top-right header opens a two-mode dialog:
1. **Guide view** — a structured platform guide rendered as markdown sections
2. **Chat view** — a RAG-powered assistant that answers questions about how to use the platform

### Guide Content (`lib/platform-guide-content.ts`)

The guide content is statically compiled into `PLATFORM_GUIDE_SECTIONS` — an array of `{id, title, body}` objects where `body` is raw markdown. Sections cover: Getting Started, Competitor Analysis tab, Running the Scout, Competitor Chatbot, Content Creation tab, Auto-Post tab. The guide is also stored as a markdown file at `docs/PLATFORM-GUIDE.md` for the help chatbot RAG.

### Help Chatbot (`backend/app/api/routers/help.py`)

`POST /api/help` — identical streaming SSE architecture to the competitor chatbot, but scoped differently:

1. `_ensure_guide_ingested()` — on first request, checks if any `platform-guide` chunks exist in RAG (`hybrid_retrieve("what is altitut", top_k=1, doc_types=["platform-guide"])`). If not, reads `docs/PLATFORM-GUIDE.md`, chunks it via `chunk_markdown()` (splitting by `##` headings, ~2,400 char chunks), and ingests. This is an automatic lazy-ingest pattern — no seeding required for the help guide.

2. `hybrid_retrieve(query, top_k=10, doc_types=["platform-guide"])` — restricts retrieval to platform-guide chunks only (never returns competitor/content-pack context).

3. System prompt: "You are the Altitut platform-help assistant. Answer questions about how to use the Social Media Command Center. If the guide does not contain the answer, say so honestly."

Both chatbots use the same `useStreamingChat` hook and `TraceBanner` error display.

---

## 12. The RAG Engine — Shared Infrastructure

The RAG engine (`backend/app/services/rag_service.py`) is the intelligence backbone that makes both chatbots work. It handles chunking, embedding, storage, in-memory caching, and hybrid retrieval.

### Chunking

**`chunk_pack(pack, doc_type)`** — splits an `AnalysisPack` into chunks:
- TL;DR gets its own chunk
- Each `PackEntry` becomes one chunk (sourceName + sectionTitle + entryLabel + entry text)
- Each `PackEpisode` in section episodes becomes one chunk
- Chunk IDs are deterministic: `{doc_type}-{source_slug}-{section_slug}-{entry_slug}`

**`chunk_markdown(title, markdown, doc_type)`** — splits a markdown document:
- Split on `\n##` headings → one section per heading
- Within each section, group paragraphs into ~2,400 char chunks
- IDs: `{doc_type}-{source_slug}-{heading_slug}-{index}`

### Embedding

`embed_texts(texts)` — uses OpenAI `text-embedding-3-small` at `dimensions=512`. Batches in groups of 96 to respect API limits. Returns 512-dimensional float arrays. Values are rounded to 6 decimal places to reduce Firestore document size.

The text sent for embedding is the chunk's "display text": `{sourceName} — {sectionTitle} — {entryLabel}\n{text}` — the source metadata is prepended to the content so embeddings capture both what the chunk says and where it comes from.

### Storage

`ingest_chunks(pending)` writes chunks to Firestore `ragChunks` in batched writes (Firestore batch API). After writing, invalidates the in-memory cache.

`remove_pack_chunks(source_name)` — deletes all chunks where `sourceName == source_name`. Used when updating a pack (delete old chunks → re-ingest new ones).

### In-Memory Cache

```python
_cache: dict[str, Any] = {"chunks": None, "loaded_at": 0.0}
CACHE_TTL_SECONDS = 120
```

On first `hybrid_retrieve()` call (or when cache is expired), all `ragChunks` documents are loaded from Firestore into memory as `RagChunk` objects. Subsequent queries within 120 seconds use the in-memory list without any Firestore read. After any ingest or removal, the cache is manually invalidated.

**Why in-memory:** Firestore has read costs and latency. RAG queries happen on every chat message. Loading once per 2 minutes is a practical balance between freshness and cost.

### Hybrid Retrieval

`hybrid_retrieve(query_text, top_k=12, doc_types=None)`:

1. **Filter by doc_type** if specified (e.g., `["platform-guide"]` for help chat)

2. **Dense retrieval** — embed the query, compute cosine similarity with every chunk's embedding vector:
   ```python
   dense = dot(query_vec, chunk_vec) / (|query_vec| * |chunk_vec|)
   ```

3. **Lexical retrieval** — BM25-inspired scoring:
   - Tokenize query and chunk text (lowercase, regex word extraction)
   - Remove stopwords from query terms
   - For each query term that appears in the chunk, compute a saturated term-frequency score
   - Normalize by query length → score ∈ [0, 1]

4. **Hybrid score**: `0.6 * dense + 0.4 * lexical + name_boost`
   - `name_boost = 0.15` if the source name appears in the query (so asking "what about Fe/male Switch?" boosts Fe/male Switch chunks)

5. Sort descending by score, return top `top_k` as `RetrievedChunk` objects with `score` field.

**Why hybrid:** Dense retrieval alone can miss exact keyword matches (a query for "F#" might not semantically match, but BM25 would find it). Lexical scoring alone misses semantic synonyms. The 60/40 weighted blend handles both.

---

## 13. Request Tracing — Error Traceability System

Introduced in the last commit (`6523d36`), the tracing system solves the problem of users seeing vague errors with no way to identify the failing backend request.

### Backend (`backend/app/api/trace.py`)

**`TraceIdMiddleware`** — Starlette middleware that runs on every request:
- Checks for incoming `x-trace-id` header; if absent, generates a 12-char hex UUID
- Stores trace ID in `request.state.trace_id`
- Adds the trace ID to the response headers: `x-trace-id: {id}`

**Exception handlers** registered on the FastAPI app:
- `http_exception_handler` for `HTTPException` — logs `[traceId] METHOD /path returned STATUS: message`, returns `{error: {message, trace_id}}`
- `general_exception_handler` for unhandled `Exception` — logs full traceback, returns `{error: {message: "Something went wrong on our side — try again in a moment.", trace_id}}`

This means EVERY failure response (4xx or 5xx) includes the trace ID both in the response body AND the response header.

### Frontend (`lib/trace.ts`, `app/components/trace-banner.tsx`)

**`newTraceId()`** — generates a 16-char hex string using `crypto.randomUUID()` (or fallback to `Date.now() + Math.random()` for older environments).

**`TraceableError`** — extends `Error` with a `traceId: string | null` field.

**All API calls** in the frontend attach the trace ID as a request header:
```typescript
headers: { "Content-Type": "application/json", [TRACE_ID_HEADER]: traceId }
```

When a response is not OK, the code reads `response.headers.get(TRACE_ID_HEADER)` from the response to get the server's trace ID (which may differ from the client's if the server generated its own).

**`TraceBanner`** component — displayed in error states for Scout, Chat, Auto-Post, and Help. Shows the error message and the trace ID with a copy-to-clipboard button. Users can quote the trace ID when reporting issues, and the team can search backend logs for `[{traceId}]` to find the exact failure.

---

## 14. Frontend Architecture — How the UI Is Built

### Entry Point: `app/page.tsx`

A single `"use client"` page that is the entire application. Three main data inputs:
- `competitorPacks` — from `useLivePacks("competitors", COMPETITOR_PACKS)` — Firestore real-time + static fallback
- `contentPacks` — from `useLivePacks("contentPacks", CONTENT_PACKS)` — same pattern

**`useLivePacks` hook** — wraps `listenToPacks()` (Firestore `onSnapshot`) in a `useEffect`. Sets `livePacks` state when Firestore pushes updates. Falls back to `fallback` static data if Firestore is unreachable or returns empty. This means the dashboard works even without Firestore connectivity.

**Tab navigation** — `useState<Tab>` switching between three tabs. Each tab renders different components.

### Layout

```
header (white, fixed top):
  "Social Media Command Center" title + subtitle
  HelpButton (top right)

body (max-w-7xl, flex):
  nav (w-56, sticky):
    tab buttons (Competitors Analysis, Content Creation, Auto-Post)
  
  main (flex-1):
    section header (current tab title + description + optional Scout button)
    
    Competitors Analysis:
      ChatPanel
      PackPanel (packs=competitorPacks, variant="competitor")
    
    Content Creation:
      PackPanel (packs=contentPacks)
    
    Auto-Post:
      AutoPostPanel → AutoPostComposer + AutoPostHistory
```

### PackPanel (`app/components/pack-panel.tsx`)

Renders any array of `AnalysisPack` items using `<details>/<summary>` accordion pattern (native HTML, no JavaScript required to expand/collapse). Structure:

```
article (card)
  details (outer accordion — pack-level)
    summary (clickable header: pack name, tag badge, meta/links)
      if !competitor: "Post" button → opens AutoPostComposer modal
    
    div (expanded content):
      PackTldr (if pack.tldr exists)
      ReferenceReelsSection (if pack.referenceReels exists)
      
      for each section:
        details (section accordion)
          summary (section title)
          
          div:
            for each entry: EntryRow (label + typed blocks)
            for each episode: 
              details (episode accordion)
                summary (episode title)
                for each episode entry: EntryRow
```

`EntryRow` renders the three block types: `paragraph` → `<p>`, `bullets` → `<ul>`, `labeled` → `<div>` with bold label + `<ul>`.

`normalizeBlocks()` handles legacy single-string entries (pre-block-schema packs that still have `entry.value: string`) by wrapping them in a paragraph block.

### Scout Dialog (`app/components/scout-dialog.tsx`)

Three visual phases controlled by `phase: "idle" | "input" | "progress"`:
1. `idle` — just the "Run Competitor Scout" button visible
2. `input` — modal with editable product description textarea
3. `progress` — modal with 8-step progress list

`runFrom(index)` is the core async loop. It is resilient: on error, it captures the failed step index and throws a `TraceableError` that the retry handler uses to resume from exactly the failed step.

### AutoPostComposer (`app/components/autopost-composer.tsx`)

The most complex frontend component (~1,200 lines). Key design decisions:
- State machine for publish flow (`publishPhase: "idle" | "validating" | "submitting" | "processing" | "published" | "error"`)
- `abortRef` to cancel in-progress polling if the user navigates away
- `pendingCaptions` — AI-generated captions are staged before applying, giving the user a "keep original / use new" choice
- `sameCopy` toggle — when enabled, any platform's caption change propagates to all platforms

### Design System Applied

The design uses Altitut's brand tokens from `tailwind.config.js`:
- `deep-teal` (`#005A6A`) — primary brand color for selected states, primary buttons, links
- `darker-teal` (`#00424F`) — hover state of deep-teal
- `maroon` (`#800000`) — used exclusively for the "Run Competitor Scout" button (visually distinct, high-priority action)
- `maroon-dark` (`#5C0000`) — hover state of maroon
- `shadow-modern` and `shadow-modern-lg` — teal-tinted box shadows throughout cards

Fonts: Inter (body, via `next/font`) + Montserrat (display/headings, via `next/font`). Tailwind classes `font-sans` (Inter) and `font-display` (Montserrat).

---

## 15. Backend Architecture — FastAPI Service

### Entry Point (`backend/app/main.py`)

```python
app = FastAPI(title="Altitut SMA API", version="0.1.0")
setup_traceability(app)  # adds TraceIdMiddleware + exception handlers

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    expose_headers=[TRACE_ID_HEADER]
)

# Routers
app.include_router(competitors.router,    prefix="/api/competitors")
app.include_router(content_packs.router,  prefix="/api/content-packs")
app.include_router(chat.router,           prefix="/api/chat")
app.include_router(help.router,           prefix="/api/help")
app.include_router(scout.router,          prefix="/api/scout")
app.include_router(telegram.router,       prefix="/api/telegram")
app.include_router(autopost.router,       prefix="/api/autopost")
```

### Configuration (`backend/app/config.py`)

`Settings` extends Pydantic `BaseSettings`. Reads from `../.env` (the `.env` at repo root). All settings have typed defaults; optional fields are `str | None = None`. Key groups:
- OpenAI: `openai_api_key`, `openai_model` (default: `gpt-4o-mini`), `embedding_dimensions` (default: 512)
- Exa: `exa_api_key`, `exa_base_url`
- Apify: `apify_token`, `apify_actor_id` (default: `apify/instagram-profile-scraper`)
- Telegram: `telegram_bot_token`, `telegram_webhook_secret`
- Upload-Post: `upload_post_api_key`, `upload_post_base_url`, `upload_post_profile`, `social_provider`
- Firebase: `firebase_project_id`, `firebase_service_account_path`, `firebase_service_account_json`
- Redis/Celery: `redis_url`, `celery_broker_url`, `celery_result_backend` (present but currently unused — infrastructure for future async tasks)

### Firebase Client (`backend/app/firebase_client.py`)

`_FirestoreProxy` — a lazy proxy class. On first attribute access, it initializes Firebase Admin SDK and creates a Firestore client. Credential resolution priority:
1. `FIREBASE_SERVICE_ACCOUNT_PATH` — direct path to JSON key file
2. `FIREBASE_SERVICE_ACCOUNT_JSON` — JSON string (written to a temp file for the SDK)
3. Application Default Credentials (GCP/`gcloud auth`)

The `db` singleton is a `_FirestoreProxy` instance. All services import and use `db` directly.

### OpenAI Client (`backend/app/services/openai_client.py`)

`complete_json(system, user, images=None, max_output_tokens=4096, validate=None, model=None)`:
- Uses `response_format: {"type": "json_object"}` to force JSON output
- If `images` provided, adds image content parts (up to 4, detail="low") for vision calls
- Up to 2 attempts — on parse failure, appends "Return ONLY a valid JSON object" repair instruction and retries once
- If `validate` callable provided, the parsed JSON is passed through it; if it raises `ValueError`, that's treated as a parse failure and triggers retry

`embed_texts(texts)` — batches in groups of 96, `text-embedding-3-small` at 512 dimensions.

`slugify(value)` — strips non-alphanumeric, lowercases, replaces separators with hyphens, truncates to 80 chars. Mirrors the TypeScript version in `lib/packs.ts`.

### Service Layer

Services are pure Python modules (no FastAPI dependency injection). Each service module imports `settings` and `db` at module level. This flat structure keeps things simple — the codebase is not large enough to need dependency injection frameworks.

**`pack_service.py`** — the "pack utilities" module:
- `normalize_block/entry/section/links()` — coerce LLM output into the typed schema
- `save_pack()` / `fetch_packs()` / `delete_pack()` — Firestore CRUD
- `pack_to_brief()` / `pack_to_ground_truth()` — convert pack to text for prompts
- `derive_media_kind/placement/platforms_from_pack()` — infer post parameters from pack content
- `sort_sections()` — enforce canonical section order
- `datetime_now()` — UTC ISO timestamp

**`social/upload_post_client.py`** — the Upload-Post vendor client:
- `get_user_profile()` — creates profile if 404
- `get_social_accounts()` — extracts connected accounts from profile
- `list_facebook_pages()` / `list_linkedin_pages()` — page discovery
- `publish_to_upload_post()` — main publish call, multipart/form-data
- `check_upload_post_status()` — status polling
- `unpublish_on_upload_post()` — post deletion

**`social/accounts.py`** — manages the `socialAccounts` Firestore cache:
- `resolve_social_account(provider)` — calls Upload-Post API, normalizes response, saves to Firestore
- `get_social_account(provider)` — reads from Firestore cache only
- `set_social_account_page(provider, page_id)` — updates stored page ID preference

---

## 16. External API Integrations

### Exa AI

Used for all web research in the competitor scout. Two endpoints:
- `/search` — semantic neural search with `type: "auto"` (auto-detects query intent). Supports `category: "company"` for company-specific results, `include_domains` for domain-restricted search, `include_text: true` with `maxCharacters` for content extraction.
- `/contents` — extract page text from specific URLs with `livecrawl: "fallback"` (tries cache first, falls back to live crawl if not cached).

All Exa calls use `httpx.Client(timeout=60)`. Results are wrapped in `ExaResult` objects for consistent `.title`, `.url`, `.text`, `.published_date` access.

### Apify

Used for Instagram scraping. Two actors:
- `apify/instagram-profile-scraper` — given `{usernames: [...]}`, returns profile data (followers, bio, posts, etc.)
- `apify/instagram-scraper` — given `{directUrls: [...], resultsType: "details"}`, returns detailed reel/post data

Both are run via `run_actor_sync()` which calls the synchronous actor run endpoint: `POST /v2/acts/{actor}/run-sync-get-dataset-items?timeout={n}`. This blocks until the actor completes and returns dataset items directly — no webhook or polling needed.

Profile scraper timeout: 150s. Post scraper timeout: 240s (longer because it downloads video frame data).

### Upload-Post

A third-party API that bridges the gap between needing a Meta/LinkedIn developer app and actually posting to social media. Key architecture points:

- **Profile concept**: An Upload-Post "profile" (`UPLOAD_POST_PROFILE`) corresponds to a set of connected social accounts. The profile is auto-created if it doesn't exist (`create_profile()`).
- **Authentication**: API key in `Authorization: Apikey {key}` header.
- **Async uploads**: `async_upload: "true"` means Upload-Post processes the upload asynchronously and returns a `job_id` or `request_id` immediately.
- **Multipart form data**: The upload endpoints require `multipart/form-data`, not JSON. `httpx` is used with `files=[(name, (None, value)), ...]` tuples to build form fields without actual file attachments.
- **Idempotency**: The `postId` UUID is sent as `Idempotency-Key` header to prevent duplicate posts on retries.
- **Result shape variations**: Upload-Post returns results in at least two shapes (array vs. dict), which `_raw_results_to_array()` normalizes.

### Telegram Bot

Simple webhook pattern:
- `POST /api/telegram` receives Telegram `Update` objects
- Bot token validation via `X-Telegram-Bot-Api-Secret-Token` header (optional)
- Idempotency via `telegramUpdates` Firestore collection
- `send_message(chat_id, text)` sends progress updates back to the user during pack building

The webhook URL is registered using `npm run telegram:webhook -- <https-backend-url>`, which runs `scripts/set-telegram-webhook.ts` to call Telegram's `setWebhook` API.

---

## 17. Design System

The dashboard follows Altitut's brand design system documented in `resources/DESIGN_GUIDE.md` and `resources/DESIGN_GUIDE_P2.md`.

### Brand Tokens (Tailwind)

| Token | Hex | Usage |
|---|---|---|
| `deep-teal` | `#005A6A` | Primary brand color — selected nav items, primary buttons, links, markers |
| `darker-teal` | `#00424F` | Hover state of deep-teal actions |
| `maroon` | `#800000` | High-priority action (Run Competitor Scout) |
| `maroon-dark` | `#5C0000` | Hover state of maroon |
| `bright-coral` | `#FF6B6B` | Alert accent (not heavily used in this app) |
| `light-grey` | `#E9ECEF` | Background tone |
| `dark-grey` | `#343A40` | Text color |

### Shadows

Custom teal-tinted shadows create depth without feeling generic:
- `shadow-modern` — `0 10px 25px rgba(0,90,106,0.1), 0 4px 10px rgba(0,90,106,0.05)` — used on cards and the side nav
- `shadow-modern-lg` — larger variant for modals

### Animations

- `animate-fade-in-up` — step panels enter from below on transition (0.6s ease-out)
- `animate-pulse` — loading indicators (amber dot for "running" steps)
- `backdrop-blur-subtle` — modal overlays

### Typography

- Body font: **Inter** (via `next/font/google`)
- Display font: **Montserrat** (via `next/font/google`) — used for the dashboard title
- Tailwind classes: `font-sans` (Inter), `font-display` (Montserrat)

---

## 18. Seeding & Static Data

### Static Data Files

`data/competitor-packs/*.json` — 10 pre-seeded competitor analysis packs (Disciplined Entrepreneurship, Fe/male Switch, GoVenture, IdeaBuddy, SimVenture, Strategyzer, Startup Wars, The-U App, Startups.com, Virtonomics).

`data/content-packs.ts` and `data/competitor-packs.ts` — TypeScript arrays exporting the static packs as `AnalysisPack[]`. These are the fallback rendered if Firestore is unreachable.

### Seed Script (`scripts/seed-firestore.ts`)

`npm run seed` runs this script which:
1. Reads all competitor packs from `data/competitor-packs/*.json`
2. Reads all content packs from `data/content-packs.ts`
3. Writes them to Firestore (`competitors` and `contentPacks` collections)
4. Chunks and embeds them into the `ragChunks` collection
5. Chunks and ingests `docs/ALTITUT-PRODUCT-OVERVIEW.md` as `docType: "altitut"` (provides Altitut product context for the competitor chatbot)
6. Chunks and ingests `docs/PLATFORM-GUIDE.md` as `docType: "platform-guide"` (provides platform help context for the help chatbot)

The seed script is idempotent — running it again overwrites existing documents with the same IDs.

---

## 19. Git History — How the Project Evolved

The project has two distinct phases: an archived v1 (May 2026) and the current build (July 2026 onwards).

### Phase 0: Archive (May 28 – June 1, 2026)

The repository previously contained a different social media analysis platform — Python FastAPI backend + React frontend with a different architecture:
- **Phase 1** (`b079f16`): Backend foundation, QA docs, test suite
- **Phase 2** (`c3db24d`): Competitor scout powered by Apify Instagram profile scraping (not web search), review workflow for approving/rejecting discovered competitors
- **Phase 3** (`46a6eac`): Posts dashboard for managing discovered content
- Additional fixes: LLM fallback, Exa provider integration, Biome lint fixes

This entire codebase was reset on July 9, 2026. It is preserved as a git tag `archive-v1` and browsable at `../ALTITUT-SOCIAL-MEDIA-ANALYSIS-archive-v1`.

### Phase 1: Scaffold (July 9, 2026)

**Commit `8ed0327`** — Reset to blank slate  
**Commit `6882f3f`** — Next.js Social Media Command Center scaffold  
Introduced the fundamental app structure: dark header, side nav, content pane layout. Added `docs/ALTITUT-PRODUCT-OVERVIEW.md`. Updated `AGENTS.md` with full company context.

### Phase 2: Static Packs (July 9, 2026)

**Commit `8e81023`** — Add competitor and content pack panels  
First functional UI — static competitor packs and content packs rendered as accordion cards. Pack schema first defined here.

**Commit `2145550`** — Enhance pack panels  
Added social links bar with icons, reference reels section, richer layout, TL;DR section. Pack data model expanded to include `links`, `referenceReels`, `tldr`.

### Phase 3: Core AI Features (July 16, 2026)

**Commit `99d6954`** — Add Firestore-backed scout, RAG chat, and Telegram content packs  
The biggest single commit. Added:
- Firestore real-time subscriptions replacing static data
- Competitor Scout 7-step workflow (Next.js API routes)
- Hybrid RAG chatbot (Next.js API routes)
- Telegram bot webhook for reel → content pack
- Full Tailwind/design system restyling
- SETUP_NEEDED_FROM_YOU.md documenting all required credentials

**Commit `54e5b9c`** — Ground reel packs in vision analysis and harden competitor scout  
Critical quality upgrade:
- Added GPT-4 vision pass for reel analysis (the "observed facts" methodology)
- Added grounding rules to prevent hallucinated production styles
- Added profile verification step to competitor scout (preventing wrong social account links)
- Added homepage relevance gate to competitor scout (preventing irrelevant picks)
- Added article-corroboration to company discovery

**Commit `176c179`** — Add Help guide and platform-usage RAG assistant  
Added the "Help ?" modal with guide view and help chatbot. Introduced `PLATFORM_GUIDE_SECTIONS` static content and the scoped RAG (platform-guide doc type).

### Phase 4: Auto-Post (July 23–25, 2026)

**Commit `8766124`** — Add Auto-Post publishing pane  
Full Auto-Post system via Upload-Post API:
- 4-step composer (media, destinations, copy, review)
- Firebase Storage direct upload
- AI caption generation (per-platform rules)
- LinkedIn + Facebook + Instagram publishing
- Social post history

**Commit `338af58`** — Wire Auto-Post into content packs  
Added the "Post" button to each content pack card. When opened from a pack, platforms/placement/captions are pre-derived from pack content.

**Commit `00b96e2`** — Graceful fallback for unconfigured platforms  
Added AUTOPOST_SETUP.md. Changed behavior so unconnected platforms are skipped (warning shown) rather than blocking the entire publish flow.

**Commit `90bf8f9`** — Fix autopost account resolution, response parsing, Firestore writes  
Production fixes: Upload-Post API response normalization (multiple result shapes), account resolution edge cases, Firestore data sanitization (`_sanitize_for_firestore()` to strip None values).

### Phase 5: FastAPI Migration (July 26–27, 2026)

**Commit `3883430`** — Port backend to FastAPI  
The entire backend was migrated from Next.js API routes to a dedicated FastAPI service. Motivations:
- Python libraries (numpy, firebase-admin, openai, httpx) are richer and more stable
- FastAPI's typing (Pydantic) is better suited to the complex data models
- Streaming SSE responses are cleaner in FastAPI
- Separation of concerns: frontend (Next.js) purely renders UI, backend (FastAPI) handles all AI/data logic
- Easier local development (uvicorn with --reload)

**Commit `26feefe`** — Bulletproof FastAPI backend, fix RAG chunk IDs, add setup README  
Stability fixes: improved error handling throughout, fixed RAG chunk ID generation, added `SETUP_NEEDED_FROM_YOU.md` documenting all credential requirements for the new FastAPI backend.

**Commit `8aae317`** — Remove Next.js API routes entirely  
Deleted `app/api/` directory. FastAPI is now the only backend.

**Commit `bff19bc`** — Wire frontend to FastAPI  
Updated `lib/api.ts` to use `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`. Updated `useStreamingChat` and all API call sites to use the `api()` helper. Fixed request/response shapes that had drifted between the old TypeScript routes and the new Python routes.

**Commit `20c5c23`** — Fix chat input state sync  
The Send button was not enabling when the user typed — `onInput` event handler was missing alongside `onChange` (needed for composition events on mobile/IME).

### Phase 6: Polish (July 27, 2026)

**Commit `9d07e26`** — Link public Mintlify documentation  
Added link to `https://altitut-sma.mintlify.app` in README, help dialog, and platform guide.

**Commit `6523d36`** — Add request tracing and user-visible bug traceability  
Added `TraceIdMiddleware`, `TraceableError`, `TraceBanner` component. Every failure now includes a copyable trace ID visible to the user.

---

## 20. Configuration, Secrets, and Environment

### `.env` at repo root (gitignored)

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini              # override to gpt-4o for higher quality

# Exa AI
EXA_API_KEY=...

# Apify
APIFY_TOKEN=...

# Telegram (optional — bot features only)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...           # optional shared secret for webhook verification

# Upload-Post (optional — Auto-Post feature only)
UPLOAD_POST_API_KEY=...
UPLOAD_POST_PROFILE=altitut           # the Upload-Post profile name

# Firebase (backend Admin SDK)
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json
# OR:
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### `.env.example` at repo root

Documents all variables without values. Committed to the repo.

### Frontend Environment

`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` — set in `.env.local` (or shell) for local development. In production, set to the FastAPI backend's public URL.

Firebase web app config is hardcoded in `lib/firebase.ts` (public Firebase config is safe to commit; security is via Firestore Rules).

### Firestore Rules

Currently open rules (no authentication required). This is appropriate for an internal tool — the dashboard is not public-facing.

---

## 21. Scripts and Tooling

### `npm run seed`

Runs `scripts/seed-firestore.ts` via `tsx`. Seeds all static competitor and content packs into Firestore + RAG. Requires Firebase credentials and OpenAI API key.

### `npm run telegram:webhook -- <url>`

Runs `scripts/set-telegram-webhook.ts`. Calls Telegram's `setWebhook` API to point the bot at the FastAPI backend URL. Requires `TELEGRAM_BOT_TOKEN`. The URL must be HTTPS (Telegram requirement).

### `npm run test:autopost`

Runs three test scripts in sequence:
1. `scripts/test-upload-post.ts` — tests Upload-Post API response parsing against mock responses
2. `scripts/test-status-queued.ts` — tests status polling state machine
3. `scripts/test-accounts.ts` — tests account resolution

### `npm run dev` / `npm run build` / `npm run start`

Standard Next.js commands. Dev server runs on port 3000.

### Backend: `cd backend && uv sync && uv run uvicorn app.main:app --reload`

`uv sync` installs Python dependencies from `pyproject.toml` into `.venv`. `uv run uvicorn ...` runs the ASGI server with hot reload. Port 8000 by default.

### Debug Scripts

- `scripts/debug-user-profile.ts` — inspect an Upload-Post user profile
- `scripts/diag-linkedin-pages.ts` — diagnose LinkedIn page connection issues
- `scripts/resolve-linkedin.ts` — resolve LinkedIn company pages
- `scripts/server-only-mock.ts` — mock server for testing

---

## Summary: The Technical Picture in One Page

**What it does:** Internal dashboard for Altitut's social media team. Three tools: (1) automated competitive intelligence with a RAG chatbot, (2) AI-generated content series plans from viral reels, (3) one-click multi-platform social publishing.

**How it's built:** Next.js 15 frontend (TypeScript, Tailwind, Firebase JS SDK for real-time data + Storage) → FastAPI backend (Python 3.11+, Pydantic v2) → Firestore (primary database), OpenAI (GPT-4o-mini synthesis + embeddings + Whisper), Exa AI (web research), Apify (Instagram scraping), Upload-Post (social publishing).

**Central data structure:** `AnalysisPack` — an 8-section (competitors) or 6-section (content) structured document. Sections contain entries with typed content blocks (paragraph / bullets / labeled). All packs live in Firestore and are chunked + embedded into a vector store.

**AI pipelines:** 
- Competitor Scout: 8 sequential async steps (discover → website → social → research → 3×synthesize → save), each driven by a single GPT-4o-mini call with specific JSON schema output, accumulated into `ScoutState`.
- Reel → Content Pack: scrape → transcribe → vision analysis → 2×synthesize. Grounded in observed facts — no hallucination of production style.
- RAG: hybrid 60% dense cosine + 40% BM25 lexical + 15% name boost, 512-dim embeddings, 120s in-memory cache.
- Caption generation: per-platform rules (char limits, hashtag handling) baked into prompts, optional pack ground truth for alignment.

**Key design principles:**
1. Client-driven workflows (step-by-step API calls, state passed forward) — enables real-time progress and step-level retries
2. Grounding rules — downstream synthesis can only use what was factually observed in the reel or researched about the competitor; prevents hallucination
3. Graceful degradation — unconnected social platforms are skipped (not blocking), Firestore unreachability falls back to static data, profile verification rejects unverified accounts rather than including wrong links
4. Request tracing — every failure includes a 12-char trace ID visible to the user for bug reporting
5. Deterministic chunk IDs — re-ingesting a pack overwrites its RAG chunks (idempotent, no orphaned embeddings)
