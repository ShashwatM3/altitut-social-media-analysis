# ALTITUT-SOCIAL-MEDIA-ANALYSIS

See the detailed product spec in [PRODUCT_SPEC.md](PRODUCT_SPEC.md)

## Overview
This project is a social media analysis dashboard for Altitut. It helps the team find relevant competitor companies, review why those companies are doing well on social media, and analyze individual posts so the team can understand what patterns are working.

The workflow is human-in-the-loop by design: the backend discovers and analyzes candidates, but the team approves what gets saved. The first version is built around a local PostgreSQL database and a dashboard that keeps competitor review and post review separate and easy to understand.

## Features
- Competitor Scout for discovering candidate competitor companies.
- Human approval flow for saving competitors.
- Posts Analysis for retrieving and analyzing competitor posts.
- Human approval flow for saving posts.
- Default approved-posts dashboard view with company-wise filtering.
- Local PostgreSQL persistence.
- Config-driven third-party integration layer with setup-required handling.
- Apify as the initial default third-party data-access path.
- OpenAI-compatible LLM analysis support for competitor and post reasoning, with setup-required handling when the API key or model is missing.
- Frontend dashboard for competitor scouting, posts analysis, approval actions, and company filtering.

## Architecture Overview
The backend is organized around a small set of clear boundaries. `backend/api/` exposes the HTTP routes, `backend/connectors/` handles third-party social/data providers, and `backend/migrations/` manages the local PostgreSQL schema.

`frontend/` renders the dashboard and approval workflow. The UI reads structured objects from the backend and maps them to expandable cards, filters, and approve/reject controls. `configs/` holds runtime and provider configuration so the project stays adaptable when external tool setup changes.

Phase 2 focuses on competitor discovery and approval. Phase 3 adds posts analysis for approved companies, with recent/popular retrieval modes and company-wise filtering in the approved feed.

The BMAD workflow docs in `bmad-docs/` define the project plan, scope, and action inbox used by the downstream agents.

## Modules
| Module / Path | Purpose |
|---|---|
| /configs | Runtime and provider configuration |
| /backend/api | HTTP routes for competitor scouting and posts analysis |
| /backend/connectors | Third-party data-access adapters |
| /backend/migrations | Local PostgreSQL schema migrations |
| /backend/db | Database helpers |
| /frontend | Dashboard UI |
| /frontend/components | Reusable dashboard UI pieces |
| /guides | Human-readable setup notes |
| /bmad-docs | BMAD workflow artifacts |

## First-time setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A local PostgreSQL instance
- Optional: an Apify account/token and an OpenAI-compatible API key if you want the full third-party integrations enabled

### 1) Clone the repo and open the project root
```bash
cd /Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS
```

### 2) Set up the backend environment
Create a virtual environment and install the API dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/api/requirements.txt
```

### 3) Set up the frontend dependencies
Install the frontend packages from the `frontend/` directory:
```bash
cd frontend
npm install
cd ..
```

### 4) Create a `.env` file at the repo root
The backend automatically loads `/Users/gobus/Desktop/main/projects/internship/altitut/ALTITUT-SOCIAL-MEDIA-ANALYSIS/.env`, so put the required values there before starting the app.

Required environment variables for the live product:
- `DATABASE_URL` — PostgreSQL connection string for your local database
- `APIFY_TOKEN` — Apify API token for competitor scouting and posts retrieval
- `OPENAI_API_KEY` — API key for the OpenAI-compatible analysis provider
- `OPENAI_MODEL` — model name to use for competitor/post analysis and live web-search scouting
- `EXA_API_KEY` — API key for the Exa discovery pipeline

Optional environment variables:
- `OPENAI_BASE_URL` — custom OpenAI-compatible endpoint
- `EXA_BASE_URL` — custom Exa-compatible endpoint if you are not using the default API host
- `APIFY_ACTOR_ID` — override the Apify actor id if you are not using the default Instagram profile scraper
- `APIFY_DATASET_ID` — override the default Apify dataset id if your flow needs it
- `APIFY_DEFAULT_PLATFORM` — override the platform label used in saved records
- `VITE_API_BASE_URL` — frontend API base URL when the backend is not running at `http://127.0.0.1:8000`

The default provider config still lives in `configs/providers/`:
- `configs/providers/apify.toml` points at the Instagram profile scraper actor by default
- `configs/providers/llm.toml` supplies the OpenAI-compatible provider metadata and docs link
- `configs/providers/exa.toml` supplies the Exa discovery provider metadata and docs link

### 5) Apply the database migrations
Apply the SQL migrations to the database before starting the app:
```bash
python -m backend.db.apply
```
If you prefer to run the schema manually, the migrations live in `backend/migrations/`.

### 6) Start the backend API
From the repo root, run:
```bash
uvicorn backend.api.main:app --reload
```
The health check should be available at `http://localhost:8000/health`.

### 7) Start the frontend dashboard
In a second terminal, run:
```bash
cd frontend
npm run dev
```
Then open the local Vite URL printed in the terminal.

### 8) Verify the main flows
- `GET /health` confirms the API is up
- `GET /integrations/apify/status` shows whether Apify is ready or still needs setup
- `GET /integrations/llm/status` confirms whether the analysis provider has credentials and a model configured
- `POST /competitor-scout` runs the Apify-backed scout flow when the provider is configured
- `POST /posts-analyze` runs the posts analysis pipeline for approved competitors
- `GET /competitors` and `GET /posts?approved=true` return the persisted review queues
- `POST /competitors/{competitor_id}/approve`, `POST /competitors/{competitor_id}/reject`, `POST /posts/{post_id}/approve`, and `POST /posts/{post_id}/reject` persist review actions to PostgreSQL

## Usage
- The dashboard is split between competitor scouting, post analysis, and approval actions.
- The system returns setup-required states when required third-party credentials or provider config are missing, so first-time users know exactly what still needs to be configured.
- Approved posts can be filtered by company using the backend query parameter, not just client-side filtering.
- Docker support still exists at the repository root via `docker-compose.yml` and the root Dockerfile if you want to run the API containerized instead of directly with Uvicorn.

## Evaluation
Success means the system can discover competitors, analyze posts, persist approved items locally, and clearly guide the user whenever a third-party tool requires external setup.
