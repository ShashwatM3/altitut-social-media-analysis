# Brainstorming Artifact
**Project:** ALTITUT-SOCIAL-MEDIA-ANALYSIS
**Produced:** SESSION-2026-05-28 / TURN #3

## Idea
Altitut wants a social media analysis system that helps the team understand which competitor companies are winning online and why. The product starts with competitor discovery, then moves into post-level analysis so the team can study what types of content, formats, and traction patterns are working in the market. The end goal is to give Altitut a practical way to copy the winning patterns in a way that still feels like Altitut.

## Interaction Modality
Web app / dashboard.
The dashboard is the main entry point for the team, with two core tools: Competitor Scout and Posts Analysis.

## Features
- Social Media Analysis Dashboard with two main sections.
- Competitor Scout tool that takes Altitut context and discovers candidate competitor companies.
- LLM-backed competitor discovery using tools such as web search, Exa, Apollo, and Crunchbase.
- Structured competitor objects containing:
  - company name
  - website
  - social links
  - short relevance explanation
  - short traction summary
- Human-in-the-loop approval for each candidate competitor.
- Persistent storage of approved competitors in a local PostgreSQL database.
- Competitor Scout rerun capability to keep the competitor list fresh.
- Posts Analysis tool that lets a user choose approved companies and choose a post retrieval mode.
- Two retrieval modes for posts:
  - Most Recent Posts
  - Most Popular Posts
- Post ingestion that captures transcript, frames, caption, and traction metrics.
- AI analysis for each post covering:
  - why the post worked
  - the visual/template design in words
  - how Altitut could adapt the pattern without copying it literally
- Structured post objects with expandable card-style UI and approval flow.
- Persistent storage of approved posts in the same local PostgreSQL database.
- Frontend phase that displays approved companies and approved posts with company-wise filtering.

## Problems Being Solved
Right now, the team needs a systematic way to understand the competitive landscape before trying to improve Altitut's social media presence. Manual competitor research is slow, inconsistent, and hard to repeat. Even when the team finds a good competitor, it is difficult to standardize why that company is relevant or which posts are actually driving traction. This tool creates a repeatable pipeline from discovery to analysis to approval to storage.

## Design Specs
- Dashboard-first web experience.
- Keep the interface clean and structured, with expandable cards for both companies and posts.
- Make HITL approval obvious with clear approve/reject controls.
- Favor concise summaries over long dense reports.
- Separate the dashboard into two clear sections:
  1. Competitor Scout
  2. Posts Analysis
- Use structured object rendering so the UI maps directly to the backend data model.
- Present post analysis as readable business insight, not technical jargon.
- The UI should help the team move from discovery to approval quickly.
- Posts feed should show all approved posts together by default, with a company filter to narrow the feed.

## Research Notes
- Instagram is likely easier to set up than LinkedIn if you stay near official APIs, because Instagram's platform docs are centered on professional accounts and have a clearer access path.
- LinkedIn's Posts API is more restrictive and is permission-gated; retrieving organization posts requires r_organization_social and member posts require approved r_member_social access.
- For your use case, neither official API is a perfect fit for broad competitor intelligence on public accounts, so a third-party data-access layer or scraper may be the practical first implementation.
- Practical tool candidates to evaluate first:
  - Apify: flexible scraping and API-first workflow
  - PhantomBuster: automation-friendly social data workflows
  - Other scraper/provider layers can be considered later if they reduce setup friction
- When a future dev task reaches a feature that depends on a third-party social/data tool, the dev agent should pause and ask the user to complete any required dashboard/account setup or provide credentials/configuration from their side.
- Before giving those instructions, the dev agent must research the official documentation for the specific tool in question and then provide step-by-step, handholding-level setup guidance based on that documentation.

## Reference Materials
- Altitut company context provided by the user.
- Instagram Platform / Instagram Graph API docs
- LinkedIn Marketing Posts API docs
- Web search
- Exa
- Apollo
- Crunchbase

## Open Questions
- Which social platforms are in scope first: LinkedIn, Instagram, X, TikTok, YouTube, or others?
- How will the agent access the social data: official APIs, browser automation, scraping, or a hybrid approach?
- Which third-party tool becomes the default data-access layer for phase 2?
- Should the dashboard include a default company filter state for posts, or show all posts and let the user filter manually?
