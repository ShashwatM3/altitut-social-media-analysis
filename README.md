# Altitut Social Media Command Center

An internal dashboard for the Altitut team to research competitors, generate content packs, and publish to LinkedIn, Facebook and Instagram.

## What it does

- **Competitor Scout** — discover a competitor, crawl their site, map their social presence, run deep research and synthesize a full competitor pack.
- **Content Packs** — turn scraped Instagram reels or manual ideas into repeatable content series with Overview, Strategy, Series, Recipe and Execution sections.
- **RAG Chat & Help** — ask questions across all packs and the platform guide; get answers grounded in your own data.
- **Telegram Bot** — send an Instagram reel link to a Telegram bot and get a finished content pack saved to the dashboard.
- **Auto-Post** — upload media, generate per-platform captions, and publish to LinkedIn, Facebook and Instagram via [Upload-Post](https://app.upload-post.com).

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3.4 |
| Backend (live) | Next.js API routes in `app/api/` |
| Backend (in migration) | FastAPI in `backend/` |
| Database / Auth | Firebase (Firestore, Storage, Auth) |
| AI | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`, Whisper) |
| Search | Exa AI |
| Scraping | Apify (`instagram-profile-scraper`, `instagram-scraper`) |
| Publishing | Upload-Post API |
| Python env | `uv` + `pyproject.toml` |

The frontend currently calls the Next.js API routes. The FastAPI backend is a complete mirror of the same pipelines and can be started independently for testing or future migration.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ and `uv` (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- A Firebase project with Firestore and Storage enabled
- API accounts: OpenAI, Exa, Apify
- Optional: Upload-Post account for Auto-Post, Telegram bot for the reel bot

## Project layout

```
app/                # Next.js frontend + API routes
  api/              # Next.js API routes (current backend)
  components/       # UI components (scout, chat, composer, ...)
  page.tsx          # main dashboard
backend/            # FastAPI mirror (uv project)
  app/main.py
  app/api/routers/  # FastAPI routes
  app/services/     # business logic
lib/                # Next.js shared libraries
docs/               # product overview and platform guide
resources/          # design docs and prompt structures
data/               # seed competitor/content packs
scripts/            # seed, webhook, diagnostic scripts
```

## 1. Initial setup

```bash
# 1. Clone the repo (already done in this workspace)
cd altitut-social-media-analysis

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies and create venv
cd backend && uv sync && cd ..

# 4. Copy the environment template
cp .env.example .env
```

## 2. Environment variables

Edit `.env` and fill in the required values.

| Variable | Why it is needed | Example |
|---|---|---|
| `OPENAI_API_KEY` | Chat, RAG embeddings, caption generation, reel analysis | `sk-...` |
| `EXA_API_KEY` | Competitor discovery and web research | `...` |
| `APIFY_TOKEN` | Instagram profile/reel scraping | `...` |
| `FIREBASE_PROJECT_ID` | Firestore and Storage project | `altitut-sma-dashboard` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional. Leave empty for Application Default Credentials | `./serviceAccountKey.json` |
| `UPLOAD_POST_API_KEY` | **Auto-Post** publishing | `...` |
| `UPLOAD_POST_PROFILE` | Upload-Post profile name | `altitut` |
| `TELEGRAM_BOT_TOKEN` | **Telegram reel bot** | `1234567890:AAE...` |
| `TELEGRAM_WEBHOOK_SECRET` | Optional webhook secret for Telegram | random hex string |

See `.env.example` for the full list with defaults.

### Firebase setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Enable **Firestore** and **Storage**.
3. Set Firestore rules to allow read/write for your team (this is an internal tool):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Set Storage rules to allow `/autopost/**` uploads:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /autopost/{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
5. For local dev, authenticate with `gcloud auth application-default login` (or set `FIREBASE_SERVICE_ACCOUNT_PATH` to a downloaded service-account key).

### Auto-Post / Upload-Post setup

1. Create a free account at https://app.upload-post.com.
2. Create a **Profile** matching `UPLOAD_POST_PROFILE` (default `altitut`).
3. Connect at least one platform:
   - **Facebook Page** you admin (not a personal profile).
   - **Instagram Business/Creator** account.
   - **LinkedIn** personal profile or company page you admin.
4. Generate an API key and paste it into `.env`.
5. Restart the dev server after editing `.env`.

To check which LinkedIn pages Upload-Post can see, run:

```bash
npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts
```

The script prints the company page URNs. The app automatically sends `target_linkedin_page_id` when publishing.

### Telegram bot setup

1. Open Telegram, search for **@BotFather**, start a chat and send `/newbot`.
2. Pick a name and username ending in `bot`.
3. Copy the **HTTP API token** into `.env` as `TELEGRAM_BOT_TOKEN`.
4. Deploy the app to a public HTTPS URL (see Deployment below).
5. Register the webhook:
   ```bash
   npm run telegram:webhook -- https://YOUR-APP.vercel.app
   ```
6. Send the bot an Instagram reel link.

## 3. Running locally

You need two terminal sessions.

### Frontend + Next.js API

```bash
npm run dev
```

Open http://localhost:3000.

### FastAPI backend (optional / future)

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for interactive API docs.

## 4. Seeding data

```bash
npm run seed
```

This ingests the predefined competitors, content packs, platform-guide chunks and any RAG data into Firestore.

## 5. Using each feature

### Competitor Scout

1. Go to the **Competitors Analysis** tab.
2. Click **Scout a competitor**.
3. Enter a product description and optionally some known competitors.
4. Walk through the steps: **Discover → Website → Social → Research → Synthesize**.
5. Click **Assemble pack** then **Save**. The pack appears in the dashboard and is ingested into the RAG store.

### Content Packs / RAG Chat

- Packs appear in the **Content Creation** tab. They are read live from Firestore.
- Click a pack to expand its sections.
- Click **Chat** to ask questions grounded in all packs and the product guide.
- Click **Help ?** for platform usage questions.

### Auto-Post

1. In the **Content Creation** tab, click **Post** on a pack (or open the composer manually).
2. Upload an image or video.
3. Select the platforms (LinkedIn, Facebook, Instagram).
4. Click **Generate captions** or edit the copy directly.
5. Review and click **Publish**.
6. The composer validates accounts, submits to Upload-Post, polls for completion and saves the result to Firestore.

Unconfigured platforms are skipped gracefully; the others still publish.

### Telegram Reel Bot

After the webhook is registered, send any Instagram reel link to your bot. The bot replies at each stage and finishes with a summary; the new pack appears in the **Content Creation** tab.

## 6. Testing

```bash
# Next.js + Auto-Post regression tests
npm run test:autopost

# Next.js build
npm run build

# FastAPI type/lint checks (from the backend/ directory)
cd backend
uv run ruff check app
uv run mypy app
```

## 7. Deployment

1. Push to GitHub.
2. Import the repo into Vercel.
3. Add all environment variables from `.env` in **Settings → Environment Variables**.
4. Enable **Fluid Compute** in **Settings → Functions** for long-running routes (scout, telegram, autopost).
5. Deploy.
6. Register the Telegram webhook:
   ```bash
   npm run telegram:webhook -- https://YOUR-APP.vercel.app
   ```

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `UPLOAD_POST_API_KEY is not set` | Missing env var | Add `UPLOAD_POST_API_KEY` to `.env` and restart |
| LinkedIn page not found | LinkedIn role is `Content admin` instead of `Super admin` | Ask the page owner to promote you to **Super admin**, disconnect/reconnect LinkedIn in Upload-Post, then re-run `scripts/diag-linkedin-pages.ts` |
| Media URL not reachable | Firebase Storage HEAD blocked | The app falls back to GET; ensure Storage rules allow public read for `/autopost/**` |
| Telegram bot does not respond | Webhook not registered or secret mismatch | Run `npm run telegram:webhook -- <url>` and check `TELEGRAM_WEBHOOK_SECRET` |
| Caption generation fails | `OPENAI_API_KEY` missing or invalid | Check `.env` and restart |
| FastAPI import errors | Missing `__init__.py` or stale venv | Re-run `cd backend && uv sync` |

## 9. Development notes

- The `app/api/` Next.js routes are the current live backend.
- The `backend/` FastAPI project mirrors the same logic and will replace the Next.js routes once the frontend is switched to call `http://127.0.0.1:8000`.
- Both share the same `.env` file at the repo root.
- Firestore is the single source of truth for packs, RAG chunks, scout runs and published posts.

## 10. Useful scripts

| Script | Purpose |
|---|---|
| `npm run seed` | Ingest seed packs and RAG chunks |
| `npm run telegram:webhook -- <url>` | Register the Telegram webhook |
| `npm run test:autopost` | Run Auto-Post regression tests |
| `npx tsx --tsconfig tsconfig.test.json scripts/diag-linkedin-pages.ts` | Check LinkedIn pages visible to Upload-Post |
| `npx tsx --tsconfig tsconfig.test.json scripts/resolve-linkedin.ts` | Resolve and cache the LinkedIn account |

## Support

For Upload-Post specific issues: `info@upload-post.com`.
