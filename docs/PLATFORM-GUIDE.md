# Social Media Command Center — How to Use This Platform

This dashboard is Altitut's internal Social Media Command Center. Use it to track competitor intelligence and turn strong social content into repeatable content packs for Altitut.

## What this platform is for

There are two jobs:

1. **Competitors Analysis** — read structured intelligence packs on competitors, ask the competitor copilot questions, and run Competitor Scout to research a new competitor automatically.
2. **Content Creation** — browse content packs (transferable reel playbooks) the social team can execute. New packs arrive from the Telegram reel bot.

Live data comes from Firestore. If Firestore is unreachable, the app falls back to the packs shipped in the repo so the UI still works.

## Layout overview

- **Header** — title plus **Help ?** (this guide and the help assistant).
- **Left nav** — switch between **Competitors Analysis** and **Content Creation**.
- **Main pane** — tools and packs for the active tab.

## Competitors Analysis tab

### Reading a competitor pack

Each competitor is an accordion-style pack with:

- Name, tag, meta line, and social/profile links when available
- A **TL;DR** summary
- Eight structured sections (identity, product, social presence, content strategy, top performers, paid, audience, verdict)
- Expand sections and entries to dig into bullets, quotes, and tables

Use packs when planning positioning, content angles, or competitive responses.

### Ask the competitor copilot

At the top of Competitors Analysis is the **competitor copilot** chat.

- It answers with **RAG** over every tracked competitor pack, content packs, and Altitut product context.
- Ask natural-language questions: compare competitors, find threats, extract content whitespace, or turn a competitor move into an Altitut action.
- Keep answers short by default; ask for a "detailed" or "full breakdown" when you want depth.
- Suggested starter questions appear when the chat is empty.

This chat is **not** for "how do I use the dashboard?" — use **Help ?** → **Ask the help assistant** for product usage questions.

### Run Competitor Scout

Click **Run Competitor Scout** (Competitors Analysis header).

1. Confirm or edit the **description of Altitut** (steers who counts as a competitor).
2. Submit — the scout runs an 8-step workflow:
   - Discover candidates (live web search + article corroboration)
   - Crawl the website and verify relevance
   - Map social profiles (Instagram, LinkedIn, X, YouTube, TikTok)
   - Deep research (news, reviews, ads, partnerships)
   - Three GPT synthesis passes into the standard 8-section pack + TL;DR
   - Save to Firestore and ingest into the RAG knowledge base
3. When finished, the new pack appears in the competitor list and the competitor copilot can answer questions about it.

Scout can take several minutes. Leave the progress dialog open until it finishes or errors; you can retry a failed step.

## Content Creation tab

### Reading a content pack

Content packs are transferable playbooks built from strong Instagram reels. Typical structure:

1. **Understanding the reel** — beat-by-beat what actually happens (vision + transcript grounded)
2. **Why it works / transfer rationale**
3. **Episode or series plan** for Altitut
4. **Production recipes** — visual, audio, caption guidance mirrored from the real reel
5. **Hooks, CTAs, and execution notes**

Open packs the same way as competitor packs: expand sections and follow the labeled entries.

### How new content packs get created (Telegram bot)

Content packs are **not** created inside the web UI today. The flow is:

1. Someone sends an Instagram **reel URL** to the Altitut Telegram content-pack bot.
2. The bot scrapes the reel (Apify), transcribes audio (Whisper), runs a **vision-grounded** analysis of frames, then synthesizes an Altitut transfer plan.
3. The pack is saved to Firestore (`contentPacks`) and ingested into RAG.
4. It shows up live on the **Content Creation** tab.

Telegram setup (bot token + public HTTPS webhook) is documented in `SETUP_NEEDED_FROM_YOU.md` for the team member who owns deploy access.

## Help ? button (you are here)

**Help ?** opens this guide. From the guide you can open **Ask the help assistant** — a separate chatbot that answers **how to use this platform** in natural language.

- Help assistant RAG is limited to this platform guide (not competitor intelligence).
- Competitor strategy questions belong in the **competitor copilot** on the Competitors tab.

## Data, seeding, and environment (for operators)

- **Firestore project**: `altitut-sma-dashboard` — collections include `competitors`, `contentPacks`, `ragChunks`, `scoutRuns`, `telegramUpdates`.
- **Seed**: `npm run seed` (re)writes predefined packs and rebuilds RAG chunks (competitors, content packs, Altitut product overview, and this platform guide).
- **Local run**: copy `.env.example` → `.env`, fill OpenAI / Exa / Apify / Telegram keys, then `npm install` and `npm run dev`.
- Secrets stay in `.env` (never commit). Long API routes may run up to several minutes on Vercel Fluid Compute.

## Quick FAQ

### How do I add a new competitor?
Use **Run Competitor Scout** on the Competitors Analysis tab. Do not hand-edit Firestore unless you know the pack schema.

### How do I add a new content pack?
Send a reel link to the Telegram bot after it is configured and deployed. The Content Creation tab updates automatically.

### Why don't I see a pack I just saved?
Wait a moment for the Firestore live listener. Refresh if needed. If Firestore is down, you will only see static fallback packs from the repo.

### Who should I ask product questions vs usage questions?
- **Product / competitor strategy** → competitor copilot (Competitors tab)
- **How this dashboard works** → Help ? → Ask the help assistant

### What is Altitut (one line)?
Altitut is an entrepreneurship-education platform (web app + game) that teaches students and early founders how to build startups — customer discovery, MVP, pitching, funding, and more.
