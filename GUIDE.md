# Project Guide

ALTITUT-SOCIAL-MEDIA-ANALYSIS is scaffolded as a simple monorepo with clear separation between the UI, API, storage/agent placeholders, and supporting docs.

## Top-level folders

- `frontend/` — the eventual user interface; currently just a placeholder README.
- `backend/api/` — the runnable FastAPI service and initial health endpoints.
- `backend/db/` — placeholder for database models, migrations, and data access.
- `backend/agent/` — placeholder for the agent/runtime layer.
- `guides/` — practical setup notes for contributors.
- `.github/workflows/` — CI placeholders for linting and deployment.
- `infrastructure/` — reserved for future deployment and ops files.
- `bmad-docs/` — BMAD workflow docs for project planning and continuity.

## Files to edit first

1. `README.md` — overall project orientation.
2. `backend/api/main.py` — API behavior.
3. `frontend/` — when the UI is ready to begin.
4. `bmad-docs/PROGRESS.md` — if you are continuing the BMAD workflow.

## Quick orientation

A new contributor should be able to understand the skeleton in under 5 minutes by reading this file, the root README, and `backend/README.md`.

## Local dev layout

Use two terminals:

1. **Repo root** — backend venv, migrations, and Uvicorn
2. **`frontend/`** — `npm run dev`

Do not run backend Python commands from inside `backend/`; imports like `backend.api` only resolve from the repo root.
