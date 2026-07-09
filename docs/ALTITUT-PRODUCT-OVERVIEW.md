# Altitut — Product Overview

*A product-perspective description of Altitut and its two products, derived from the `altitut-webapp` and `altitut-game` codebases.*

---

## 1. What Altitut Is

**Altitut is an entrepreneurship-education platform** that teaches students and early founders how to build a startup — from finding an idea, to interviewing customers, to building an MVP, to pitching and applying for funding. It is designed to be used both by individual founders and by instructors running a class (the codebase repeatedly references a college course structure, e.g. class code `X3QCJ1` / `eng108`).

Rather than being a single app, Altitut ships the *same underlying curriculum and data* through **two distinct front-end products** that target two different modes of learning:

| | **Altitut Web App** | **Altitut Game** |
|---|---|---|
| Nature | A structured, tool-like "startup operating system" / LMS | A 2D pixel-art RPG world (Gather.town style) |
| Feel | Professional, iOS-clean, dashboard-driven | Playful, immersive, exploratory |
| Primary job | Do the real work and track progress | Learn and practice the same skills through play |
| Built with | React 19 + TypeScript + Vite + Tailwind | Phaser 3 + React 18 + TypeScript + Vite |
| Best for | Focused work sessions, instructors, deliverables | Onboarding, engagement, gamified skill drills |

Both products are **two windows onto one platform**. They share the same brand, the same Firebase project, the same FastAPI backend (`altitut-backend-*.run.app`), the same accounts, and much of the same feature logic. A student can move between them and see the same startup, the same class, and the same progress. The glue is described in Section 4.

**Shared technical foundation (both products):**
- **Auth & data:** Firebase Authentication (email verification required) + Firestore + Cloud Storage.
- **Backend:** a shared FastAPI service handling AI analysis, scoring, idea generation, and reward/progression rules.
- **AI:** used throughout for pitch/deck analysis, interview transcription and insight extraction, idea generation (Ikigai), persona avatars, MVP mockups, and a conversational mentor.
- **Design language:** clean, mobile-first, teal-accented; the game layers a pixel-art aesthetic on top.

---

## 2. Product 1 — Altitut Web App

### Positioning
The web app is Altitut's **"do the work" product**: a comprehensive React platform where a founder actually builds and validates their startup and where an instructor runs the class. It is organized as a set of tabs, each a tool in the founder's journey, with a bottom nav on mobile that becomes a sidebar on desktop.

### Who it's for
- **Students / founders** — the core users building a startup.
- **Instructors** — who create classes, upload session materials, set assignments, and grade via a dedicated class dashboard and gradebook.
- **Public visitors** — who can view published startup profiles, verify badge credentials, and submit external job applications without logging in.

### The core tabs (the product surface)

1. **Home ("Mission Control")** — the central dashboard. Progress metrics (interviews completed, validated hypotheses, pitch recordings, MVP projects, personas, Ikigai progress), an activity calendar with streaks and deadline markers, a competition countdown with a startup-to-competition match score, quick actions, and a startup-completion status bar.

2. **Course (Class Dashboard)** — appears only for enrolled students. Class info, session-by-session materials, assignment submission and status, recordings, grades, and a class chat. This is the instructor-facing LMS layer (sessions, gradebook, accommodations, submissions, feedback).

3. **My Startup** — a WYSIWYG startup-profile builder with Build / Preview / Analytics / Competitors tabs. Founders enter name, tagline, description, industry, stage, logo, team members (with email invitations and editor permissions), funding info, and social links, then **publish a public profile** with its own URL and view analytics. The Competitors tab includes a 2D positioning matrix and an "Altitut Graveyard" of failed startups to learn from.

4. **Funding** — a discovery hub for competitions, grants, and free resources. Deadline-sorted competition cards with eligibility filters and AI-computed **match scores**, full competition detail pages, an integrated application flow (including AI-assisted answers and reuse of the master pitch), and a **Free Resources** library with application-tracking checklists (Available / Applied / Received).

5. **Pitch** — the pitch toolkit, split into:
   - **Review** — upload a pitch deck PDF and get an AI analysis (overall, clarity, structure, engagement, impact scores, plus slide-by-slide feedback and gap analysis).
   - **Craft** — a 7-section guided builder (Hook, Problem, Solution, Market, Business Model / Traction, Team, Ask) with templates, rich editing, versioning, and auto-save.
   - **Practice** — in-browser video recording of the pitch (MediaRecorder) with AI feedback on delivery and a timestamped review dashboard.

6. **Learning** — the structured curriculum: sequentially-unlocking modules (Problem Discovery, Hypotheses, Interviewing, Personas, Synthesizing Insights, 60-Second Pitch, MVP 101, Testing & Iteration, Launch, Growth Hacking, Scoreboard & Metrics, etc.) made of interactive sessions with tasks, reflections, decision points, mini-lessons, quizzes, badges, and XP. Some sessions are gated behind real work (e.g. completed interviews or personas).

7. **Interviews** — an end-to-end customer-discovery hub: plan interviews (hypothesis-linked questions, templates), conduct them live (recording + real-time notes + a Live Coach), or upload notes; the AI transcribes, extracts insights, tags sentiment, and suggests hypothesis validation. Includes hypotheses tracking, an analysis/insights view, participant management, and interview debriefs with next steps.

8. **MVP** — three build modes: **Draw Product** (sketch screens; AI enhances the prompt and generates realistic mockups + a PRD), **Prototype Builder** (clickable prototypes with an AI chat and component library), and **GitHub Workspace** (initialize a repo and scaffold starter code).

9. **Ikigai** — a guided, purpose-driven idea-discovery flow. Users fill four circles (Passion, Expertise, Mission, Profession), the AI synthesizes them (including local market-trend analysis and a resume/market-research parser), and generates startup ideas that can be pushed straight into the Pitch tab. A 7-step timeline with autosave.

10. **Personas** — sequential customer-persona workflow: **Customer Discovery** → **Product-Market Fit** → **Pricing Discovery**, with AI-generated avatars, interview-data integration, fit scoring, and pricing/willingness-to-pay analysis.

11. **Profile** — user account, stats, badge collection, class enrollment (via instructor code), public-profile toggle, security settings, and data export/deletion.

### Cross-cutting web-app systems
- **Badge & credential system** — earned badges and shareable, publicly-verifiable "Block Certificate" credentials (with LinkedIn sharing and OG-image generation).
- **Tutorial system** — 63+ guided tips across all screens, versioned and synced via Firebase, with a debug mode.
- **Cloud-Agent MVP (Agent Tasks)** — an emerging feature where users submit tasks to an AI agent, review/revise/approve AI-generated previews and outlines, keep version history, and export approved output as Markdown.
- **Integrations** — Zoom, Google Calendar/Meet, Microsoft Teams, Slack, Notion, HubSpot, and Salesforce, plus a calendar for scheduling interviews.
- **Team collaboration** — startups have team IDs, email invitations, and real-time multi-editor sync.

---

## 3. Product 2 — Altitut Game

### Positioning
The game is Altitut's **"learn by playing" product**: a 2D top-down, pixel-art RPG where the founder's journey becomes a world to explore. It takes the same skills the web app teaches and turns them into environments, characters, and mini-games. It is a full PWA (installable, mobile-friendly with touch controls) and, like the web app, sits behind login.

### The world (navigation & spaces)
The player controls an avatar (WASD / arrow keys; `X` to interact; `Esc` to close overlays) that walks between scenes rendered from AI-generated 4K pixel-art backgrounds:

- **The Garage** — the starting hub. A computer dashboard, a Kanban whiteboard, a customizable **pet** (dog/cat/rabbit), and a player-info panel with startup stats, skills, and inventory. This is where the founder builds their startup.
- **Startup City (Plaza)** — the social overworld: the Bit Bar (networking), the Startup Store, an innovation plaza, and NPC founder HQs (TechCorp, InfoTech, CodeHaven, etc.).
- **Pitch Arena** — a "Demo Day" arena with a presentation stage, live leaderboard screens, expo booths, and a networking lounge, where the player pitches.
- **Four Startup Worlds** — themed skill zones, each an explorable map with its own core mini-game, unlocked at Level 2:
  - 🔥 **The Spark** — *Ideation & Creativity* → mini-game **Idea Spark**: read a teen-founder's problem, pick the best of four solutions (tagged best/ok/wrong), against a global timer; star rating based on "best" picks.
  - ⚒️ **The Forge** — *Product Building* → mini-game **Crisis Comms**: respond to messages from investors/users/co-founders; each choice shifts trust, runway, and scope creep, with teaching feedback.
  - 🏦 **The Vault** — *Financial Management* → an expense-triage game: drag startup expenses into Essential / Nice-to-have / Cut-it buckets within a budget.
  - 🏔️ **The Summit** — *Growth & Scaling* → a **Lean Canvas** builder: match cards (Problem, Customer Segments, UVP, Solution, Channels, Revenue, Metrics, Costs, Unfair Advantage) to their slots, with decoys ramping up per round.

  Mini-games support **English / Chinese / Spanish**, have "how to play" overlays, emit XP/completion events, and can involve daily limits and paid (in-game-currency) replays.

### The gamified curriculum: "Week 1 — Build Your Startup"
The game reproduces the web app's **My Startup** onboarding as a rewarded, step-by-step quest inside the Garage. Ten tasks — project title, tagline, logo, industry, stage, hook, problem, solution, **MVP drawing**, and **publish** — each grant game coins (50–200), with a completion bonus. The MVP drawing and pitch flows, Ikigai intro, interviews, and learning content all exist as in-world experiences, often embedding the web app's own modules.

### Progression & economy
- **Game Coins** — earned from tasks and play, spent on replays and the store.
- **Store XP** — a second currency; coins convert to Store XP in fixed packs (e.g. 5,000 coins → 150 XP, up to 50,000 → 3,000).
- **Levels** — gate content (Startup Worlds require Level 2); daily rewards drive return visits.
- **Pets** — collectible companions that follow the avatar around the Garage.
- **Leaderboards & competitions** — arena leaderboards, weekly winners, score-trend overlays, and personal history.
- **AltiChat ("Alti")** — an in-game AI mentor accessible from the bottom bar (BUILD / STORAGE / **Alti** / TASKS / WORLDS).
- **Customization** — pixel founder avatars (gender/skin-tone variants, unlockable pixel characters).

---

## 4. How the Two Products Fit Together

Altitut is deliberately **one platform, two clients**:

- **One account, one backend.** Both apps authenticate against the same Firebase project and call the same FastAPI backend. A student's startup, class enrollment, badges, interviews, and pitch data are the same records regardless of which app they open.

- **Single sign-on hand-off.** The game can launch the web app (or the Store) in a new tab or iframe and pass the session across: the game posts an `ALTITUT_AUTH_TOKEN` message (a Firebase custom token) to the web app, which signs the user in with it and replies with an `ALTITUT_AUTH_TOKEN_ACK`. This lets the game **embed the web app's richer flows** (e.g. the full pitch workstation, the Store, MVP drawing) inside the game shell without a second login.

- **Shared curriculum and features, re-skinned.** Many web-app services are ported into the game (Ikigai, interviews, learning, pitch, MVP draw). The game presents them as world experiences; the web app presents them as tools. The "Week 1" quest in the game is literally the web app's My Startup builder, gamified with coin rewards.

- **Same class layer.** Both apps support joining a class via an instructor code (`AcceptClassEnrollmentScreen` exists in both), so instructors can run a cohort while students choose whichever experience suits them.

**In short:** the **Web App** is where the real startup work, class management, and deliverables live; the **Game** is an engaging, playful skin over the same journey that drives onboarding, practice, and retention. Together they let Altitut meet a learner wherever they are on the spectrum from "I want to play" to "I need to ship."

---

## 5. At-a-Glance Summary

**Altitut** = an entrepreneurship-education platform delivered as two products over one shared Firebase + FastAPI + AI backend.

- **Altitut Web App** — React 19 productivity suite / LMS: Home, Course, My Startup, Funding, Pitch, Learning, Interviews, MVP, Ikigai, Personas, Profile — plus badges/credentials, instructor gradebook, integrations, and an emerging AI Agent Tasks feature.
- **Altitut Game** — Phaser 3 pixel-art RPG: Garage → City → Arena → four Startup Worlds (Spark, Forge, Vault, Summit), with mini-games, a coin/XP/level economy, pets, leaderboards, an AI mentor (Alti), and a gamified "Week 1: Build Your Startup" quest that mirrors the web app.

The two are bound together by shared accounts, cross-app SSO, embedded flows, and a common curriculum — making Altitut a single learning journey accessible through both a serious tool and a game.
