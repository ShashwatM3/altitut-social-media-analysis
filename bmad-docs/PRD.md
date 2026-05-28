# Product Requirements Document
**Project:** ALTITUT-SOCIAL-MEDIA-ANALYSIS
**Produced by:** PM Agent — SESSION-2026-05-28 / TURN #6
**Based on:** BRAINSTORM.md

## Overview
This project builds a web dashboard for Altitut that helps the team discover competitors and analyze social media posts in a repeatable way. The system starts with competitor scouting, then moves into post-level analysis so the team can see what content patterns are working and why. The product is designed to support human review at each important step so the team stays in control of what gets saved.

## Why This Exists
Altitut needs a faster, more structured way to understand who they compete with and what those competitors are doing on social media. Manual research is slow, inconsistent, and hard to operationalize. This product turns that research into a workflow the team can run repeatedly, review manually, and store in a local database.

## Success Criteria
- The app can discover competitor candidates, let a user approve them, and persist approved competitors in local PostgreSQL.
- The app can retrieve posts for approved companies, analyze those posts, let a user approve them, and persist approved posts in local PostgreSQL.
- The dashboard can show all approved posts by default and filter them by company.
- When a required third-party social/data tool is not configured, the backend returns a structured setup-needed response instead of guessing or failing silently.
- The project can be run locally against a local PostgreSQL instance end to end.

---

## Phase 1: Foundation, Data Model, and Integration Contracts
**Goal:** The codebase has a working local backend foundation, a local PostgreSQL path, and explicit contracts for third-party setup states before any real social-data calls are made.

**What gets built:**
- Local PostgreSQL schema and migration path for competitors, posts, approvals, and run metadata.
- Backend API foundation with health checks and structured JSON response patterns.
- Config-driven integration layer for third-party social/data providers, with Apify as the initial default provider path.
- A standard "setup required" response shape that lists missing user-side configuration steps.
- Project documentation for where configuration lives and how the backend reports missing prerequisites.

**Completion criteria:**
- [ ] The backend health endpoint returns 200 on a local run.
- [ ] Database schema/migrations can be applied successfully to a local PostgreSQL instance.
- [ ] A missing third-party provider configuration returns a structured setup-required response with next steps.
- [ ] The repository contains a clear config location for integration settings, and the backend reads from it without hardcoding provider values.

---

## Phase 2: Competitor Scout Backend
**Goal:** The backend can discover competitor candidates for Altitut, normalize them into structured objects, and persist approved competitors.

**What gets built:**
- Competitor Scout API route that accepts Altitut context and returns structured candidate companies.
- Candidate schema with company name, website, social links, relevance summary, and traction summary.
- Human-in-the-loop approval endpoint that stores approved competitors.
- Ability to rerun competitor scouting without breaking previously approved entries.
- Explicit setup-required handling when the configured data-access source is unavailable. [SPECULATIVE]

**Completion criteria:**
- [ ] The competitor scouting endpoint returns a structured list of candidate companies.
- [ ] Approving a competitor writes a durable record to local PostgreSQL.
- [ ] Running the scout again does not corrupt or lose previously approved competitor records.
- [ ] When the required third-party source is missing, the endpoint returns setup-required instructions instead of a partial or fabricated result.

---

## Phase 3: Posts Analysis Backend
**Goal:** The backend can retrieve and analyze posts for approved companies, then persist approved posts for later dashboard review.

**What gets built:**
- Posts analysis API route that accepts selected approved companies and a retrieval mode.
- Support for "Most Recent Posts" and "Most Popular Posts".
- Per-post data normalization for transcript, frames, caption, and traction metrics.
- AI analysis output for why a post worked, how the design works, and how Altitut could adapt it.
- Human-in-the-loop approval endpoint that stores approved posts.
- Company-level filtering data support so the frontend can show all posts by default and narrow them by company.
- Explicit setup-required handling when the configured post source is unavailable. [SPECULATIVE]

**Completion criteria:**
- [ ] The posts analysis endpoint returns structured post objects with the originating company attached.
- [ ] The endpoint supports both recent and popular retrieval modes.
- [ ] Approved posts can be written to local PostgreSQL and read back later.
- [ ] Company-based filtering works at the API/data layer so the frontend can filter the default all-posts feed.
- [ ] Missing third-party configuration produces a structured setup-required response with concrete next steps.

---

## Phase 4: Dashboard Frontend
**Goal:** The dashboard presents competitor scouting and post analysis in a clean interface with approval controls and company-wise filtering.

**What gets built:**
- Dashboard layout with two main sections: Competitor Scout and Posts Analysis.
- Expandable cards for competitor candidates and post candidates.
- Approve/reject controls wired to the backend.
- Default posts view that shows all approved posts together, with a company filter to narrow the feed.
- Clear display of setup-required states so the user knows when action is needed on their side.

**Completion criteria:**
- [ ] The dashboard renders both main sections successfully.
- [ ] Approved competitors and approved posts are visible in the UI from persisted backend data.
- [ ] Changing the company filter changes which posts are shown.
- [ ] Approve/reject actions update the UI and persist through the backend.
- [ ] Setup-required states are visible and distinguishable from ordinary loading or error states.

---

## Phase 5: Hardening, Setup Guidance, and End-to-End Validation
**Goal:** The system is reliable, the setup path is documented, and third-party tool dependencies are guided by official documentation rather than assumptions.

**What gets built:**
- Handholding-level setup guides for every third-party integration used by the product.
- Smoke tests and integration checks for the local PostgreSQL-backed flows.
- End-to-end verification of competitor scout and posts analysis flows.
- Clear documentation for what the user must configure in external dashboards or tool accounts.
- Final cleanup of edge cases and setup-required user journeys.

**Completion criteria:**
- [ ] Each third-party dependency has a documented setup guide sourced from official docs.
- [ ] The main local end-to-end flow can run from discovery to approval to persistence without manual code edits.
- [ ] Missing configuration paths consistently produce setup guidance instead of silent failure.
- [ ] The local database-backed flows can be smoke-tested repeatably.

---

## Non-Functional Requirements
- All third-party integrations must be config-driven, not hardcoded.
- The backend must explicitly surface setup-required states when external credentials, permissions, or dashboard actions are missing.
- Local PostgreSQL is the only required database for the initial version.
- API responses should be structured and stable enough for the frontend to render directly.
- The posts dashboard must not include search in v1; only company-wise filtering is required.
- The initial implementation should favor Instagram-first post access, with LinkedIn support deferred or added later as a separate integration path.

## Scope Boundaries
**In scope:**
- Competitor discovery and approval.
- Post retrieval, analysis, and approval.
- Local PostgreSQL persistence.
- Company-wise filtering for approved posts.
- Setup-required handling and user-guided third-party configuration.

**Out of scope:**
- Search inside the saved posts dashboard.
- Fully autonomous social monitoring or scheduled posting.
- Multi-tenant SaaS features.
- Cloud database requirement for v1.
- Silent background use of third-party integrations without user approval or setup.
