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

The app is a **Next.js (App Router) + TypeScript** webapp at the repo root,
styled after **IBM's Carbon Design System** (IBM Plex Sans via `next/font`,
Carbon color tokens hand-rolled in plain CSS / CSS modules — no Carbon or
Tailwind dependency). Layout: dark Carbon-style header (title + "Help ?"
button), a 20%-width side nav with two tabs (Competitors Analysis, Content
Creation), and an 80%-width content pane.

- `npm install` — install dependencies
- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build and serve
- No test suite yet.

Keep new UI consistent with the Carbon tokens defined in `app/globals.css`.

## Working notes

- `.env` / `.env.example` at the repo root carry over credentials from the
  previous build (see the archive guide); `.env` is gitignored — never commit
  it.
- If you materially change the stack or add tooling, update the section above
  so the next agent isn't left guessing.
