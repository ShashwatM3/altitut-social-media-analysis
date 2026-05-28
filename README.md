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
- Default all-posts dashboard view with company-wise filtering.
- Local PostgreSQL persistence.
- Config-driven third-party integration layer with setup-required handling.
- Apify as the initial default third-party data-access path.
- Instagram-first initial post-access path, with LinkedIn support deferred or added later.

## Architecture Overview
The backend is organized around a small set of clear boundaries. `backend/api/` exposes the HTTP routes, `backend/connectors/` handles third-party social/data providers, and `backend/migrations/` manages the local PostgreSQL schema.

`frontend/` renders the dashboard and approval workflow. The UI reads structured objects from the backend and maps them to expandable cards, filters, and approve/reject controls. `configs/` holds runtime and provider configuration so the project stays adaptable when external tool setup changes.

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

## Setup
1. Install Python dependencies:

```bash
pip install -r backend/api/requirements.txt
```

2. If you want to run the API with a real local PostgreSQL database or use the migration helpers, set `DATABASE_URL` in your shell or update `configs/runtime.toml`.

3. If you want to enable the Apify integration later, set `APIFY_TOKEN` in your shell and fill in `configs/providers/apify.toml` with the Apify actor you want to run.

4. Start the API:

```bash
uvicorn backend.api.main:app --reload
```

## Usage
- Open `http://localhost:8000/health` to verify the backend is running.
- Open `http://localhost:8000/integrations/apify/status` to see whether the Apify integration is ready or still needs setup.
- Use `POST /competitor-scout` to run the Apify-backed scout flow when configured; it records setup-required state until `APIFY_TOKEN` and `provider.actor_id` are present.
- Use `GET /competitors`, `POST /competitors`, and `POST /competitors/{competitor_id}/approve` to manage competitor records in local PostgreSQL.
- Apply `backend/migrations/001_init.sql` to your local PostgreSQL database, or run `python -m backend.db.apply` after installing `psycopg[binary]`.
- Docker support still exists at the repository root via `docker-compose.yml` and the root Dockerfile; this quickstart uses the local Uvicorn path.

## Evaluation
Success means the system can discover competitors, analyze posts, persist approved items locally, and clearly guide the user whenever a third-party tool requires external setup.
