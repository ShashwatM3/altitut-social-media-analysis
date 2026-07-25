# Backend architecture — Redis, Celery & CI/CD design

This document is a living design for the FastAPI backend that backs the Altitut Social Media Command Center. It covers the Redis/Celery job queue and caching layer plus the GitHub Actions CI/CD pipelines. Treat it as the source of truth for the next implementation phase.

## 1. Goals

1. **Never let a long-running AI/vendor call block an HTTP request.**
   - Competitor Scout (Exa + Apify + GPT × 3 passes) can take 2–5 minutes.
   - Telegram reel pipeline (Apify scrape → Whisper → GPT vision → synthesis) can take 1–3 minutes.
   - Auto-Post publish/poll against Upload-Post is inherently async.
2. **Cache expensive and slow-changing calls** so repeated work is cheap.
3. **Give the frontend visibility into progress** (status, warnings, percent done).
4. **Make retries and idempotency trivial** for flaky vendors.
5. **Keep CI/CD fast and safe** with linting, type checking, and mocked tests.

## 2. Redis usage

Redis is used for **both** Celery broker/results and a direct application cache.

- **Celery broker**: task routing, worker scaling.
- **Celery result backend**: job state + return values.
- **Application cache** (`redis-py` connection pool):
  - Apify Instagram profile/reel scrapes keyed by `username` or `post_url`.
  - Exa `search` / `contents` keyed by query + options hash.
  - OpenAI embeddings keyed by SHA-256 of normalized text.
  - Upload-Post `status` polls keyed by `request_id`/`job_id` with short TTL.
  - RAG chunk load (optional cross-process cache in front of Firestore).

TTL guidelines:

| Data | TTL | Rationale |
|------|-----|-----------|
| Apify reel scrape | 1 hour | Reels are timely; reuse within a session |
| Apify profile scrape | 6 hours | Follower counts and posts change slowly |
| Exa search/contents | 24 hours | Article indexes and homepages do not change rapidly |
| OpenAI embeddings | 30 days | Text → embedding is deterministic and cheap to store |
| Upload-Post status | 30 seconds | Avoid hammering vendor during polling |
| RAG chunks | 2 minutes | Mirror the existing in-memory cache, but shared |

## 3. Celery task design

### 3.1 New module layout

```
backend/app/
  celery_app.py            # Celery app factory + config
  tasks/
    __init__.py
    scout.py               # run_scout_pipeline
    reel.py                # build_reel_pack
    autopost.py            # publish_autopost, poll_autopost
    rag.py                 # ingest_pack_chunks
```

### 3.2 Job state persistence

A new Firestore collection `jobs` stores:

```json
{
  "id": "celery-task-id-or-idempotency-key",
  "type": "scout|reel|autopost|rag",
  "status": "queued|running|success|failure",
  "progress": 0.45,
  "state": { "...original workflow state..." },
  "result": { "packId": "..." },
  "warnings": ["..."],
  "error": "...",
  "createdAt": "2026-...",
  "updatedAt": "2026-..."
}
```

Celery tasks write this document with `Task.update_state` callbacks and the FastAPI frontend polls `/api/jobs/{job_id}`.

### 3.3 Task definitions

`tasks/scout.py`
- `run_scout_pipeline(state: ScoutState, idempotency_key: str)`
- Runs all 8 steps sequentially, updating Firestore `jobs` after each step.
- Returns `AnalysisPack`.
- Idempotent: if `idempotency_key` exists in `jobs` with `status = success`, return stored result.

`tasks/reel.py`
- `build_reel_pack(reel_url: str, pack_number: int, idempotency_key: str)`
- Reuses `reel_service.build_content_pack_from_reel`.
- Saves to `contentPacks` and ingests RAG chunks.

`tasks/autopost.py`
- `publish_autopost(state: AutopostState)`
- `poll_autopost(post_id: str)` scheduled with `celery beat` every 30s until terminal.
- Upload-Post status is cached in Redis to avoid redundant vendor calls.

`tasks/rag.py`
- `ingest_pack_chunks(pack_id: str, doc_type: str)`
- Background chunking + embedding of a saved pack.

### 3.4 Routing

Use one default queue (`celery`) initially. If volumes grow, split:

- `scout` — long research tasks.
- `reel` — media/transcription tasks.
- `autopost` — publishing/polling tasks.
- `rag` — embeddings ingestion.

## 4. FastAPI changes

### 4.1 New endpoints

- `POST /api/jobs` — enqueue a job (scout, reel, autopost, rag). Returns `job_id`.
- `GET /api/jobs/{job_id}` — fetch current `JobRecord` from Firestore.
- `POST /api/scout` (async) — enqueue `run_scout_pipeline` and return `job_id`.
- `POST /api/reel` (async) — enqueue `build_reel_pack`.
- `POST /api/autopost` (async) — enqueue `publish_autopost`; `poll_autopost` is handled by a periodic Celery beat task.
- Existing step-by-step endpoints remain for the interactive Scout UI but can optionally be backed by the same tasks.

### 4.2 SSE option

For real-time progress, add an optional `/api/jobs/{job_id}/stream` SSE endpoint that reads Firestore `jobs` document changes and emits `progress`, `warning`, `done` events.

## 5. Caching implementation

Add `backend/app/services/cache.py` wrapping `redis-py`:

```python
class Cache:
    def get(self, key: str) -> str | None: ...
    def set(self, key: str, value: str, ttl: int) -> None: ...
    def get_json(self, key: str) -> Any | None: ...
    def set_json(self, key: str, value: Any, ttl: int) -> None: ...
```

Cache keys prefix with `altitut:` and include a version slug (`v1:`) so invalidation is easy.

Integrate into clients:
- `exa_client.search` / `contents` → check cache before network, store on miss.
- `apify_client.scrape_instagram_profiles` / `scrape_instagram_post` → check cache before actor run.
- `openai_client.embed_texts` → per-text cache with SHA-256 key.
- `upload_post_client.check_upload_post_status` → cache for 30s.

## 6. GitHub Actions CI/CD

### 6.1 `.github/workflows/ci.yml`

Two parallel jobs:

**backend-ci**
```yaml
- uses: actions/setup-python@v5
- uses: astral-sh/setup-uv@v2
- run: uv sync
- run: uv run ruff check app
- run: uv run mypy app
- run: uv run pytest
```

**frontend-ci**
```yaml
- uses: actions/setup-node@v4
- run: npm ci
- run: npm run lint
- run: npm run build
- run: npm run test:autopost  # existing mocked Upload-Post regression tests
```

Secrets required for tests that hit live APIs should be avoided; use `pytest` fixtures and `VCR.py` / `responses` / `respx` to record/replay vendor responses.

### 6.2 Deployment options

**Option A — Google Cloud Run (recommended)**
- `Dockerfile` in `backend/`.
- `gcloud run deploy` triggered by pushes to `main`.
- Use Cloud Run + Cloud Tasks for Celery or a small `gce` VM for workers.
- Firebase service account already lives in GCP; least friction.

**Option B — Railway / Fly.io**
- Dockerfile or native buildpack.
- Redis provided by service (Upstash/Railway Redis).
- Good for quick iteration.

**Option C — Vercel + separate FastAPI host**
- Keep Next.js frontend on Vercel.
- Deploy FastAPI to Cloud Run/Railway.
- `VITE_API_BASE_URL` points to deployed backend.

### 6.3 Secrets management

- GitHub repository secrets:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `OPENAI_API_KEY`
  - `EXA_API_KEY`
  - `APIFY_TOKEN`
  - `UPLOAD_POST_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
- CI does **not** commit `.env`.
- `FIREBASE_SERVICE_ACCOUNT_PATH` in runtime is set to a temporary file created from `FIREBASE_SERVICE_ACCOUNT_JSON`.

## 7. Rollout plan

1. Add `celery` and `redis` to `pyproject.toml`.
2. Implement `app/celery_app.py` and `app/tasks/` with the four core tasks.
3. Add `app/services/cache.py` and instrument existing clients.
4. Replace synchronous `scout`/`reel`/`autopost` endpoints with job enqueue + poll.
5. Add `/api/jobs` endpoints and optional SSE.
6. Write `pytest` tests with mocked Redis/Celery/Firestore.
7. Add `backend/Dockerfile` and `.github/workflows/ci.yml`.
8. Add deployment workflow once a target platform is chosen.

## 8. Open questions to decide before implementation

1. Do we keep the interactive 8-step Scout UI as step-by-step HTTP calls, or move it entirely to a single Celery job with streaming progress?
2. Which deployment platform: Cloud Run, Railway, or Fly.io?
3. Do we need a separate Cloud Tasks/Scheduler queue for `autopost_poll`, or is Celery beat sufficient?
4. Should RAG chunks stay in Firestore or move to a dedicated vector store (e.g. Pinecone/Weaviate) as scale grows?
