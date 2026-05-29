# Backend

This folder contains backend services:
- `api/` FastAPI service
- `db/` database helpers and migration utilities
- `connectors/` third-party social/data provider adapters

## Run API locally

From the repository root:

```bash
pip install -r backend/api/requirements.txt
uvicorn backend.api.main:app --reload
```

Open:
- http://localhost:8000
- http://localhost:8000/health
- http://localhost:8000/integrations/apify/status

Docker support still exists at the repository root via `docker-compose.yml` and the root Dockerfile; this quickstart uses the local Uvicorn path.

## Apify scout flow

`POST /competitor-scout` runs the Apify-backed competitor scout when `APIFY_TOKEN` and `configs/providers/apify.toml` are configured. Request body must include either usernames or profile_urls; both are normalized into Instagram usernames before calling Apify. If either piece is missing, the endpoint returns a structured setup-required response instead of guessing.

## Posts analysis flow

`POST /posts-analyze` runs the posts analysis backend for approved competitors. The endpoint accepts approved `competitor_ids` and uses their saved Instagram profile links to retrieve post data. It also accepts direct `usernames` or `profile_urls` for ad hoc runs. The dashboard filters approved posts by company with `GET /posts?approved=true` and approval updates use `POST /posts/{post_id}/approve`. Rejections use `POST /posts/{post_id}/reject`.

## Integrations

- `GET /integrations/apify/status` shows whether the Apify scout path is ready.
- `GET /integrations/llm/status` shows whether the OpenAI-compatible analysis provider is ready. If `OPENAI_API_KEY` or `provider.model` is missing in `configs/providers/llm.toml`, the endpoint returns a setup-required response instead of guessing.

## Database

The initial schema lives in `backend/migrations/001_init.sql`.
Use that migration against your local PostgreSQL instance before running the full backend flows.
