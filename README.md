# ALTITUT-SOCIAL-MEDIA-ANALYSIS

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
| /backend/db | Database layer placeholder |
| /backend/agent | Agent runtime placeholder |
| /frontend | Dashboard UI |
| /frontend/components | Reusable dashboard UI pieces |
| /guides | Human-readable setup notes |
| /bmad-docs | BMAD workflow artifacts |

## Setup
_To be filled in by Developer Agent after initial setup._

## Usage
_To be filled in by Developer Agent after initial setup._

## Evaluation
Success means the system can discover competitors, analyze posts, persist approved items locally, and clearly guide the user whenever a third-party tool requires external setup.
