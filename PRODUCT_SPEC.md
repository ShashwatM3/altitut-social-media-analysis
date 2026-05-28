# Product Spec

---

## Overview

**Goal:** Give the Altitut team a structured, agent-powered workflow to understand the competitive social media landscape — who's winning, how they're winning, and how Altitut can replicate and own those patterns.

**Who uses this:** Internal team members at Altitut.

**Dashboard structure:** Two tools, side by side —
1. **Competitor Scout** — discover and approve competitors
2. **Post Analysis** — analyze and approve competitor posts

---

## Tool 1 — Competitor Scout

### Purpose
Before any social media analysis can happen, the team needs a curated list of actual competitors. Competitor Scout automates this discovery using an LLM agent with pre-loaded Altitut context.

### How It Works

**Agent Setup**
- Pre-loaded with a company context profile for Altitut (configurable in a future version)
- Equipped with tools: web search, Exa, Apollo, Crunchbase, and others
- On trigger, the agent researches and returns a list of potential competitor companies

**Per-Competitor Data Returned**
Each competitor is a structured object containing:
| Field | Description |
|---|---|
| `website_url` | Link to their website |
| `socials` | Links to Instagram, LinkedIn, etc. |
| `relevance_summary` | 2-liner — why they're similar to Altitut |
| `traction_summary` | 2-liner — company/product traction achieved |

### UI — Competitor Scout Section

- **Approved Competitors** are shown as **expandable cards**, each displaying the structured data above
- Each card has a **✅ green tick / ❌ red cross** — the Human-in-the-Loop approval step
  - ✅ Approve → company is saved to the `competitors` table in the database (with all fields)
  - ❌ Reject → card is dismissed
- A **"Run Competitor Scout"** button lets the team re-run discovery at any time to surface new competitors

---

## Tool 2 — Post Analysis

### Purpose
For each approved competitor, scrape and analyze their social media posts to understand what's working, why it's working, and how Altitut can adapt those patterns.

### Step 1 — User Input Form
Before the agent runs, the user fills out a short form:

| Question | Options |
|---|---|
| Which companies to analyze? | Multi-select from approved competitors |
| Which posts to retrieve? | `Most Recent Posts` or `Most Popular Posts` |

### Step 2 — Agent Execution
On form submit, the agent visits each selected company's social media pages and retrieves posts matching the user's selection. For each post, it collects:

| Field | Description |
|---|---|
| `transcript` | Spoken/text content of the post |
| `frames` | Key frames extracted from video |
| `caption` | Post caption |
| `traction` | Likes, comments, shares |

### Step 3 — AI Analysis
Once posts are retrieved, an AI analysis layer runs on each post and produces:

1. **Why it worked** — breakdown of what drove engagement
2. **Post design / template** — structure and format described in plain language
3. **Altitut adaptation** — how Altitut can copy the template and make it distinctly theirs

### Step 4 — Human-in-the-Loop Approval
Results are returned as **expandable cards**, one per post, each showing:
- Company name
- Raw post details (caption, traction, frames)
- AI analysis (why it worked, design template, Altitut adaptation)
- **✅ / ❌** approval control

Approved posts are saved to the database with all fields intact.

---

## Data Model (High-Level)

### `competitors` table
```
id | name | website_url | socials | relevance_summary | traction_summary | approved_at
```

### `analyzed_posts` table
```
id | competitor_id | platform | caption | transcript | traction | frames | why_it_worked | design_template | altitut_adaptation | approved_at
```

---

## Agent Architecture (High-Level)

```
Competitor Scout Agent
├── Tools: web_search, Exa, Apollo, Crunchbase
├── Context: Altitut company profile (pre-loaded, configurable later)
└── Output: List<CompetitorObject>

Post Analysis Agent
├── Input: selected competitor socials + post type filter
├── Steps: scrape → extract (transcript, frames, caption, traction) → AI analysis
└── Output: List<PostAnalysisObject>
```

---

## Future Considerations
- Configurable Altitut company context profile (editable by admin)
- Scheduled / recurring Competitor Scout runs
- Cross-competitor pattern synthesis ("here's what ALL your competitors do well")
- Direct content brief generation from approved posts
