# Frontend

This folder contains the Phase 4 dashboard UI.

## Run locally

From this folder:

```bash
npm install
npm run dev
```

The app expects the backend at `http://localhost:8000` by default. Override it with `VITE_API_BASE_URL` if needed.

## What it covers

- Competitor Scout form and returned candidate cards
- Competitor approval and dismiss controls
- Explicit Apify setup-required banner states
- Optional LLM setup-required banner states when the backend exposes `/integrations/llm/status`
- Posts Analysis form for approved companies
- Recent / popular retrieval mode selection
- Company-wise filtering for approved posts
- Post approval and dismiss controls
- Persisted review state mirrored in the dashboard UI
