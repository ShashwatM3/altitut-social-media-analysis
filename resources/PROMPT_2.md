# PROMPT 2 — Competitor Pack Builder

> **How to use:** Run in Cowork with the **Apify MCP** connected (plus web search / Exa for the website side). Run **once per competitor**, feeding a single entry from the `competitors.json` produced by Prompt 1.
>
> **Output = ONE structured pack object per competitor,** segmented by the 8-section information architecture defined below. Every node in that architecture is a self-contained, dropdown-able chunk of meaning your dashboard renders directly — you do **not** produce loose files and reshape them afterward; each collection step writes **straight into its IA node**. Raw scraped datasets are kept aside only for provenance.

---

## PARAMETERS (edit before running)

- **Competitor:** `[paste the single object from competitors.json — name, slug, websites, socials]`
- **Our product (the "what can Altitut steal" lens):** Altitut — entrepreneurship-education product (web-app LMS + gamified RPG) for students & early founders.
- **Depth:** `[Standard = last ~50 posts/platform + top 10 performers | Deep = last ~150 + top 20]`
- **Budget cap per Apify run (USD):** `[e.g. 2.00]`
- **Pilot first:** `true` (always run a 10-item test per Actor before the full pull)

---

## ROLE & PRIME DIRECTIVE

You build **one competitor pack** — a thorough, multi-layered, and above all **accurate** profile of a single competitor, organized by the fixed 8-section architecture below. Every factual claim must trace to a source (a scraped dataset item, a URL, or a live page). **Never fabricate** a number, caption, follower count, or content pillar. Mark **observed** vs **inferred**; give a reliability on every inference. Write **"not available"** rather than guessing. Depth comes from real extracted data, not filler.

---

## HOW YOU COLLECT (two parallel workstreams)

Run these in parallel; each bullet notes the **IA node** its output lands in.

**Workstream A — Website & Product.** For every product/marketing URL: read home, product/features, pricing, "how it works"/onboarding (use `apify/rag-web-browser` or web fetch). Derive → highlight features + most-attractive features + why they land (`§2`), messaging/pricing/CTAs/funnel/social proof (`§2.3`), and what Altitut can borrow from how the *site converts* (`§2.4`).

**Workstream B — Social.** Per platform the competitor is on: pull profile + stats (`§3`), harvest the last N posts, then isolate top performers (`§5`), and derive the cross-platform content strategy (`§4`), audience signals (`§7`), and paid layer (`§6`).

### Extraction model (tag every attribute with its tier so the reader knows how much to trust it)
- **Tier 1 — structured metadata (high reliability, automated):** type, timestamps, hashtags, audio, duration, followers, likes/comments/shares/saves/views. → `§3`, `§5.numbers`.
- **Tier 2 — text + transcript (high reliability, automated):** captions + **reel/video transcripts**. Yields pillars, spoken hooks, CTAs, value-prop claims, brand voice, comment sentiment. → `§4`, `§5.content`, `§7`.
- **Tier 3 — single cover frame (medium reliability, automated multimodal):** read the **cover/thumbnail only** for on-image hook text (OCR), production style, cover consistency. No frame-by-frame video analysis. → `§4.hook_patterns`, `§4.production_style`.
- **Tier 4 — sampled deep pass (do NOT automate across everything):** named recurring series, editing/pacing nuance, "why *this* outlier won." Apply to the **top 10–20 performers only**. → `§5.why_it_won`, `§4.recurring_series`.

### Reel-vs-post decision logic (resolves the transcript blocker)
For each item: **reel/video →** fetch the **transcript** (primary content signal). **Static post/carousel →** no audio; use the **caption + read the cover/slide images multimodally**. Never block a static post waiting on a transcript.

---

## APIFY TOOLING (confirm live via MCP `search-actors` / `fetch-actor-details`; verify the input schema before each pull)

| Job | Actor (verify before use) | Notes |
|---|---|---|
| IG profile + followers | `apify/instagram-profile-scraper` | bio, followers, last ~12 posts |
| IG followers only (cheap, schedulable) | `apify/instagram-followers-count-scraper` | snapshot on a cadence → growth velocity |
| IG posts feed | `apify/instagram-post-scraper` | `isSponsored`, `videoViewCount`, `latestComments` |
| **IG reels + transcript** | `apify/instagram-reel-scraper` | **returns transcript, views, shares** — solves the reel blocker |
| IG comments (threads) | `apify/instagram-comments-scraper` | sentiment / whitespace |
| TikTok profile/posts | `clockworks/tiktok-scraper` | metrics, music, hashtags |
| **TikTok transcripts** | `clockworks/tiktok-transcript-extractor` | subtitles + AI speech-to-text |
| X / Twitter | `apidojo/tweet-scraper` | cheap per-1k tweets |
| LinkedIn company | `harvestapi/linkedin-company` | firmographics |
| LinkedIn posts | `apimaestro/linkedin-posts-search-scraper-no-cookies` | **cookieless only — never use account-cookie Actors** |
| YouTube (+ transcript Actor) | `streamers/youtube-scraper` | if the competitor is YouTube-heavy |
| **Paid ads** | Meta Ad Library Actor (Store search: "Meta Ad Library") | live ads = proven winners |
| Influencer/UGC | Meta "branded content partnerships" Actor | who they pay for reach |
| Website reading | `apify/rag-web-browser` | agent-optimized page reader |

**Cost discipline (mandatory):** 10-item pilot per Actor first; conservative `resultsLimit`; pass `memory` / `timeout` / `maxTotalChargeUsd` to stay under the cap; widen only after the pilot looks right; on partial/error items, check the Actor's Issues tab before retrying.

---

## THE PACK — fixed 8-section information architecture

Populate **every** node. Per-platform sections are arrays (one object per platform). Per-item sections are arrays (one object per post). Section 4 is derived **cross-platform** (brand voice/pillars are usually consistent across platforms); if a competitor genuinely runs different *strategies* per platform, note it in `content_strategy.per_platform_divergence` rather than fragmenting the section. Section 5 is the **connective evidence**: each "why it won" is the raw proof behind a §4 pattern and a §8 recommendation.

```json
{
  "meta": {
    "name": "", "slug": "", "tier": "direct | strong-adjacent | partial",
    "snapshot_date": "", "overall_confidence": "high | medium | low",
    "refresh_cadence": ""
  },

  "1_identity": {
    "snapshot": { "one_liner": "", "tier": "", "why_they_compete": "" },
    "positioning": { "value_prop": "", "differentiation": "" },
    "audience_icp": "",
    "similarity_to_us": { "c1_presence": 0, "c2_audience": 0, "c3_motive": 0, "rationale": "" }
  },

  "2_product_website": {
    "highlight_features": [ { "feature": "", "why_pushed": "" } ],
    "most_attractive_features": [ { "feature": "", "why_it_lands": "" } ],
    "messaging_conversion": {
      "headline_copy": "", "pricing": "", "primary_ctas": [""],
      "funnel_path": "", "social_proof": ""
    },
    "insights_to_imbibe": [ "" ]
  },

  "3_social_presence": {
    "platforms": [
      {
        "platform": "instagram",
        "profile_stats": { "handle": "", "followers": 0, "verified": false, "bio_links": [""] },
        "cadence": { "posts_per_week": 0, "consistency": "", "notes": "" },
        "format_mix": { "reel_pct": 0, "carousel_pct": 0, "static_pct": 0, "story_pct": 0 },
        "engagement_rate": { "value_pct": 0, "basis": "normalized to followers", "notes": "" },
        "growth_velocity": { "trend": "", "from_snapshots": [""] }
      }
    ]
  },

  "4_content_strategy": {
    "pillars": [ { "pillar": "", "share": "", "example_refs": [""], "reliability": "" } ],
    "recurring_series": [ { "name": "", "format": "", "cadence": "" } ],
    "hook_patterns": [ { "pattern": "", "source": "spoken | on-cover", "reliability": "" } ],
    "cta_funnel_intent": { "dominant_intent": "awareness | conversion | mixed", "notes": "" },
    "brand_voice": "",
    "production_style": { "style": "", "trend_audio_usage": "" },
    "per_platform_divergence": ""
  },

  "5_top_performers": [
    {
      "rank": 1, "platform": "", "url": "", "type": "reel | carousel | static",
      "content": { "transcript_or_caption": "", "on_cover_text": "" },
      "numbers": { "likes": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0 },
      "why_it_won": "", "repeatable_formula": ""
    }
  ],

  "6_paid_partnerships": {
    "active_ads": [ { "creative_desc": "", "angle": "", "running_since": "", "url": "" } ],
    "partnerships": [ { "partner": "", "type": "influencer | ugc | branded-content", "notes": "" } ]
  },

  "7_audience_community": {
    "sentiment": { "praise": [""], "complaints": [""], "overall": "" },
    "whitespace": [ "" ],
    "responsiveness": { "replies": true, "speed": "", "notes": "" },
    "owned_community": [ { "type": "discord | newsletter | group | other", "detail": "" } ]
  },

  "8_synthesis": {
    "winning_formula": "",
    "recent_strategic_shifts": "",
    "steal_avoid_test": { "steal": [""], "avoid": [""], "test": [""] },
    "content_pack_hooks": [ { "pillar_or_format": "", "why_feed_forward": "" } ]
  },

  "sources": [
    { "claim_ref": "", "actor_id": "", "run_or_dataset_id": "", "url": "", "pull_date": "", "reliability": "" }
  ]
}
```

### What each section means (so nodes stay logically clean)
Each top-level section is a distinct **epistemic layer**, read top to bottom as a progression: **1 who they are → 2 what they sell → 3 how big they are → 4 what they actually say → 5 proof it works → 6 what they pay for → 7 what the crowd says → 8 so what.** Keep §3 (numbers/reach) and §4 (substance/themes) strictly separate — that split is what stops the pack turning into a stats-and-themes soup.

---

## ACCURACY, PROVENANCE & QA

- Every number/claim in §1–§8 has a matching entry in `sources`. No orphan facts.
- Derived/inferred fields carry `reliability`; observed facts don't need it but should be source-referenced.
- Engagement is always a **rate**, never raw follower count as the headline. Report hidden metrics as hidden (e.g. IG returns `-1`), don't estimate.
- Keep the untouched scraped datasets aside (with Actor IDs + run/dataset IDs + pull dates) so §4 clustering can be re-derived later without re-scraping.

**Final QA (before declaring the pack done):**
- [ ] Ran a pilot per Actor and stayed under the budget cap?
- [ ] Every reel has a transcript (or a logged reason it's missing); every static post has caption + cover read?
- [ ] Every §4 attribute is tier- and source-tagged?
- [ ] Top performers actually teared down in §5 (not just listed), and each links to a §4 pattern / §8 action?
- [ ] Paid/ad-library layer attempted for every platform that has one?
- [ ] §3 populated per-platform; §4 derived cross-platform with a divergence note where warranted?
- [ ] §8 ends with concrete steal/avoid/test items + explicit content-pack hooks?
- [ ] `sources` complete, with dates and a refresh cadence in `meta`?