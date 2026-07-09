import type { AnalysisPack } from "../app/components/pack-panel";

export const CONTENT_PACKS: AnalysisPack[] = [
  {
    name: "Startup Teardown",
    tag: "Pack 01",
    meta: "45–90s Reel · IG / TikTok / Shorts",
    sections: [
      {
        id: "overview",
        title: "1. OVERVIEW",
        entries: [
          {
            label: "1.1 Series Name + Premise",
            blocks: [
              {
                type: "paragraph",
                text: '"Startup Teardown" — A social media team member breaks down a real, recognizable startup on a whiteboard, dissecting its origin story and strategy using Altitut\'s own startup-building framework as the lens.',
              },
              {
                type: "labeled",
                label: "One-line hook concept",
                items: [
                  '"We reverse-engineer how [famous startup] actually made it — using the same framework you can use to build yours."',
                ],
              },
              {
                type: "labeled",
                label: "What makes this a franchise (not a one-off)",
                items: [
                  "Same host, same whiteboard, same framework categories — only the startup and angle change.",
                  "Episode numbering (Teardown #1, #2, #3…) builds binge and completionist behavior.",
                  "Every episode is a disguised product demo of how Altitut thinks about building startups.",
                  "Recognizable company names drive click-through; framework drives saves and shares.",
                ],
              },
            ],
          },
          {
            label: "1.2 Format & Platform",
            blocks: [
              {
                type: "labeled",
                label: "Format",
                items: [
                  "UGC talking-head + whiteboard breakdown.",
                  "Short-form vertical video (9:16).",
                  "Live sketching in-frame — not pre-drawn slides.",
                  "Host speaks directly to camera throughout; no detached voiceover.",
                ],
              },
              {
                type: "labeled",
                label: "Length",
                items: [
                  "Target: 60–90 seconds per episode.",
                  "Hard ceiling: 90 seconds — depth comes from focus, not runtime.",
                  "Hook must land in first 3 seconds before any drawing starts.",
                ],
              },
              {
                type: "labeled",
                label: "Platforms",
                items: [
                  "Instagram Reels — primary distribution.",
                  "TikTok — cross-post with platform-native caption tweaks.",
                  "YouTube Shorts — cross-post; slightly longer description for search.",
                  "Do not lazy-cross-post identical captions — adapt CTA and hashtag mix per channel.",
                ],
              },
              {
                type: "labeled",
                label: "Visual mode",
                items: [
                  "Physical whiteboard OR tablet/stylus digital board — pick one and never mix.",
                  "Host visible while drawing — authenticity is the format.",
                  "Episode badge in consistent corner (e.g. \"Teardown #14\").",
                ],
              },
            ],
          },
          {
            label: "1.3 Origin",
            blocks: [
              {
                type: "paragraph",
                text: "This series comes from a whitespace observation: competitors talk about startup success in the abstract (motivational quotes, generic tips) but rarely run structured, franchise-able teardowns of specific companies using a repeatable framework.",
              },
              {
                type: "bullets",
                items: [
                  "Every teardown is a live demo of the Altitut framework — product marketing disguised as education.",
                  "Pull competitor content gaps from the Competitor Packs panel to prioritize angles.",
                  "Example: if competitors cover funding stories but ignore GTM → lean into GTM teardowns.",
                  "Example: if competitors post mindset content but never name real companies → name them.",
                  "Complements Pack #02 (Glossary): Pack #1 goes deep on companies; Pack #2 goes deep on terms.",
                  "Maintain a rolling backlog of 10–15 pre-approved startups for batch filming.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "strategy",
        title: "2. STRATEGY",
        entries: [
          {
            label: "2.1 What It Promotes",
            blocks: [
              {
                type: "paragraph",
                text: "The Altitut framework itself — the structured process the platform uses to guide a user from idea to startup. Each episode implicitly sells the framework by using it as the analytical lens, without ever feeling like an ad.",
              },
              {
                type: "bullets",
                items: [
                  "Ikigai / idea discovery → show how the startup found their problem space.",
                  "Customer interviews & personas → show how they understood their audience.",
                  "MVP & validation → show what they shipped first and why.",
                  "GTM & growth → show the channel or tactic that actually worked.",
                  "Never say \"download Altitut\" in the video body — let the framework sell itself.",
                  "CTA captures leads who want the blank version of the framework used on screen.",
                ],
              },
            ],
          },
          {
            label: "2.2 Goal",
            blocks: [
              {
                type: "labeled",
                label: "Primary goal",
                items: [
                  "Awareness — reach startup-curious scrollers via recognizable company names.",
                  "Engagement — comments, saves, shares driven by \"insider breakdown\" appeal.",
                  "Position Altitut team as credible operators, not just another edtech account.",
                ],
              },
              {
                type: "labeled",
                label: "Secondary goal",
                items: [
                  "Conversion via comment-to-DM funnel into framework templates / lead capture.",
                  "Build a save-worthy library of teardown episodes for evergreen discovery.",
                  "Feed high-performing teardown topics back into Pack #02 glossary terms.",
                ],
              },
            ],
          },
          {
            label: "2.3 Who It's For",
            blocks: [
              {
                type: "paragraph",
                text: "Aspiring founders, early-stage builders, and startup-curious professionals who follow business content but haven't started building yet.",
              },
              {
                type: "bullets",
                items: [
                  "People who consume \"startup lore\" (YC stories, founder documentaries, business breakdown accounts).",
                  "Primed to want a practical next step — not satisfied by motivation alone.",
                  "Likely 18–35, students or early career, global English-speaking.",
                  "Not for experienced operators — don't pick obscure B2B SaaS unless the lesson is universal.",
                  "Not for teachers directly — but students who discover Altitut may bring it to class.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "series",
        title: "3. THE SERIES → WHAT TO MAKE",
        episodes: [
          {
            title: "Episode 1 — How [Startup A] Found Its First 1,000 Users",
            entries: [
              {
                label: "3.1.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"How [Startup A] Found Its First 1,000 Users"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Pick a startup with a well-documented early distribution story (e.g. Airbnb, Dropbox, Notion — verify facts before filming).",
                      "Angle: distribution hack, not product features — the \"how they got users\" story.",
                      "Title must name the company — recognition drives the click.",
                    ],
                  },
                ],
              },
              {
                label: "3.1.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: 'Spoken hook: "This company had zero users and no marketing budget. Here\'s exactly what they did."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Visual hook: draw a big \"0\" on the whiteboard and cross it out immediately.",
                      "Deliver hook to camera BEFORE turning to the board — face first, then draw.",
                      "Tone: confident insider, not hype influencer.",
                    ],
                  },
                ],
              },
              {
                label: "3.1.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat whiteboard flow — sketch in real time as you narrate:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: Sketch founder + the problem they noticed (30 seconds).",
                      "Beat 2: Draw a box labeled \"Target audience\" — who they actually built for.",
                      "Beat 3: Walk through ONE specific early distribution tactic (community seeding, cold outreach, clever hack — pick the real story).",
                      "Beat 4: Circle the repeatable principle — e.g. \"go where your users already are.\"",
                      "Do NOT try to cover the full company history — one tactic, one lesson.",
                    ],
                  },
                ],
              },
              {
                label: "3.1.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: 'Spoken + on-screen text: "Comment \'BUILD\' and I\'ll send you the exact framework I just used to break this down."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Keyword must be single word, all caps in caption for visibility.",
                      "DM automation or manual reply with PDF / Notion link to blank framework.",
                      "Reply to every BUILD comment within 2 hours of posting.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: "Episode 2 — The Positioning Trick [Startup B] Used to Beat Bigger Competitors",
            entries: [
              {
                label: "3.2.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"The Positioning Trick [Startup B] Used to Beat Bigger Competitors"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Pick an underdog vs. incumbents story (e.g. Slack vs. email, Figma vs. Adobe).",
                      "Angle: positioning and story choice, not feature comparison.",
                      "Frame: smallest player in the room who won anyway.",
                    ],
                  },
                ],
              },
              {
                label: "3.2.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"They were the smallest player in the room. Here\'s how they won anyway."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Visual: draw big players as large boxes, underdog as small box — size contrast immediate.",
                      "Emotional hook: everyone loves an underdog.",
                    ],
                  },
                ],
              },
              {
                label: "3.2.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat flow:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: Sketch competitive landscape — 2–3 big incumbents vs. the underdog.",
                      "Beat 2: Break down their specific positioning / story choice (what they said NO to).",
                      "Beat 3: Show how positioning mapped to a clear ICP — one audience box.",
                      "Beat 4: Land the takeaway — \"positioning is picking who you lose on purpose.\"",
                    ],
                  },
                ],
              },
              {
                label: "3.2.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Comment \'TEARDOWN\' for the fill-in-the-blank version of this breakdown."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Deliverable: blank positioning canvas matching what was drawn on screen.",
                      "Different keyword from Episode 1 — track which CTA converts better.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: "Episode 3 — The Go-To-Market Move That Made [Startup C] Blow Up",
            entries: [
              {
                label: "3.3.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"The Go-To-Market Move That Made [Startup C] Blow Up"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Pick a startup famous for ONE channel or tactic (e.g. Dollar Shave Club video, Calendly link strategy).",
                      "Angle: single GTM bet — not omni-channel marketing.",
                      "Title promises specificity: \"one move\", not \"marketing strategy\".",
                    ],
                  },
                ],
              },
              {
                label: "3.3.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"One channel. That\'s all they used to get their first 10,000 customers."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Visual: write \"1 CHANNEL\" large on board — constraint creates curiosity.",
                      "Contrarian to \"you need to be everywhere\" narrative.",
                    ],
                  },
                ],
              },
              {
                label: "3.3.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat flow:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: Sketch a simple funnel — awareness → trial → customer.",
                      "Beat 2: Isolate the ONE channel/tactic that did the heavy lifting.",
                      "Beat 3: Explain why it worked for THEIR specific audience (not generic advice).",
                      "Beat 4: Note what would NOT have worked and why — shows critical thinking.",
                      "Circle the principle: \"GTM is a bet, not a checklist.\"",
                    ],
                  },
                ],
              },
              {
                label: "3.3.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Comment \'FRAMEWORK\' and I\'ll send the worksheet I just used."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Deliverable: GTM decision worksheet (channel, audience, bet, metric).",
                      "Track FRAMEWORK keyword volume vs. BUILD and TEARDOWN.",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "recipe",
        title: "4. THE RECIPE → HOW TO MAKE",
        entries: [
          {
            label: "4.1 Structure",
            blocks: [
              {
                type: "labeled",
                label: "Hook (0–3s)",
                items: [
                  "Bold claim or surprising stat about the startup.",
                  "Delivered to camera before any whiteboard action.",
                  "Face visible, direct eye contact, no intro music sting.",
                ],
              },
              {
                type: "labeled",
                label: "Setup (3–15s)",
                items: [
                  "Who / what / problem — sketched in real time.",
                  "Keep strokes simple — clarity beats artistry.",
                ],
              },
              {
                type: "labeled",
                label: "Body / Breakdown (15–60s)",
                items: [
                  "Walk through 2–4 framework categories with sketches.",
                  "Categories: target audience, strategy, key bet, growth loop — pick 2–3 per episode.",
                  "Do NOT try to cover everything — one episode, one lesson.",
                ],
              },
              {
                type: "labeled",
                label: "Takeaway (60–75s)",
                items: [
                  "One circled, underlined principle — the \"steal this\" moment.",
                  "Always use the same highlight color for takeaways across the series.",
                ],
              },
              {
                type: "labeled",
                label: "CTA (75–90s)",
                items: [
                  "Direct ask tied to a specific comment keyword.",
                  "Hold up phone or point down — visual cue for comment action.",
                ],
              },
              {
                type: "labeled",
                label: "Target length",
                items: ["60–90 seconds total."],
              },
            ],
          },
          {
            label: "4.2 Visual Style",
            blocks: [
              {
                type: "bullets",
                items: [
                  "Physical whiteboard OR tablet/stylus — pick one, stay consistent forever.",
                  "Host always in-frame, talking while drawing — never voiceover over static art.",
                  "Episode number badge in consistent corner (\"Teardown #14\") for series recognition.",
                  "Consistent marker colors — always circle takeaways in the same color (e.g. red).",
                  "On-screen text minimal — whiteboard IS the text.",
                  "Lighting: face well-lit, board readable — test before batch filming.",
                ],
              },
            ],
          },
          {
            label: "4.3 Audio",
            blocks: [
              {
                type: "bullets",
                items: [
                  "Direct-to-camera voice as primary audio — no lip-synced trend audio.",
                  "Authenticity matters more than production polish for this format.",
                  "Light, low-key background music bed (business/focus genre) at low volume.",
                  "Music fills dead air during drawing — must not compete with speech.",
                  "Avoid trending meme sounds — credibility depends on expertise, not entertainment mimicry.",
                  "Record audio in same take as video when possible — sync issues kill trust.",
                ],
              },
            ],
          },
          {
            label: "4.4 Caption + Hashtags",
            blocks: [
              {
                type: "labeled",
                label: "Caption template",
                items: [
                  "Line 1: Teardown #[X]: How [Startup] did [specific thing]. 🧵 Full breakdown ⬆️",
                  "Line 2: (blank line)",
                  "Line 3: Want the framework? Comment '[KEYWORD]' 👇",
                ],
              },
              {
                type: "labeled",
                label: "Hashtag set (5–8 tags, mix broad + niche)",
                items: [
                  "#StartupTeardown",
                  "#FounderStory",
                  "#StartupStrategy",
                  "#BuildInPublic",
                  "#[StartupName]",
                  "#Entrepreneurship",
                  "#GTMStrategy",
                  "#StartupTips",
                ],
              },
              {
                type: "labeled",
                label: "Caption rules",
                items: [
                  "Swap #[StartupName] per episode.",
                  "Swap [KEYWORD] to match episode CTA (BUILD / TEARDOWN / FRAMEWORK).",
                  "YouTube Shorts: add 2-sentence description with startup name for search.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "execution",
        title: "5. EXECUTION",
        entries: [
          {
            label: "5.1 Cadence",
            blocks: [
              {
                type: "paragraph",
                text: "1–2 episodes per week.",
              },
              {
                type: "bullets",
                items: [
                  "Lower frequency than Pack #02 by design — more research per episode.",
                  "Batch film 3–4 episodes in one session to stay ahead of schedule.",
                  "Publish Tuesday or Wednesday for B2B-adjacent founder audience peak.",
                  "Never skip a week without announcing — consistency builds franchise trust.",
                ],
              },
            ],
          },
          {
            label: "5.2 Roles & Effort",
            blocks: [
              {
                type: "labeled",
                label: "On-camera talent",
                items: [
                  "1 team member — consistent face for series recognition.",
                  "Same person hosts every episode; do not rotate unless building two franchises.",
                ],
              },
              {
                type: "labeled",
                label: "Research / scripting",
                items: [
                  "Light-to-moderate effort per episode.",
                  "Verify all public facts about the startup before recording.",
                  "Avoid unverified claims or anything that could read as disparaging.",
                  "Prep beat sheet (not word-for-word script) — 1 page max.",
                ],
              },
              {
                type: "labeled",
                label: "Filming",
                items: [
                  "Single take or few takes — raw whiteboard format is part of the appeal.",
                  "Minimal editing: trim dead air, add episode badge, add music bed.",
                ],
              },
              {
                type: "labeled",
                label: "Difficulty",
                items: [
                  "Medium overall — research burden is the bottleneck, not production.",
                ],
              },
            ],
          },
          {
            label: "5.3 What Good Looks Like",
            blocks: [
              {
                type: "paragraph",
                text: "Core signals that tell you the series is working — not vanity metrics alone.",
              },
              {
                type: "labeled",
                label: "Primary metrics",
                items: [
                  "Comment-to-view ratio — are people engaging or just watching?",
                  "Keyword-comment volume — how many people type the CTA keyword (BUILD, TEARDOWN, FRAMEWORK).",
                  "This proves content lands AND CTA converts attention into leads.",
                ],
              },
              {
                type: "labeled",
                label: "Secondary metrics",
                items: [
                  "Save rate — indicates reference value; feeds algorithm distribution.",
                  "Share rate — teardown \"insider knowledge\" should be share-worthy.",
                  "DM conversion rate — keyword comment → actual DM received → link clicked.",
                ],
              },
              {
                type: "labeled",
                label: "Decision triggers",
                items: [
                  "If keyword comments spike on GTM episodes → film more GTM teardowns.",
                  "If saves high but comments low → CTA may be too weak — test new keywords.",
                  "If views low but saves high → hook/title problem, not content quality.",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Becoming a Multi-Million Dollar Founder, One Day at a Time",
    tag: "Pack 02",
    meta: "30–60s Reel · IG / TikTok / Shorts",
    sections: [
      {
        id: "overview",
        title: "1. OVERVIEW",
        entries: [
          {
            label: "1.1 Series Name + Premise",
            blocks: [
              {
                type: "paragraph",
                text: '"Becoming a Multi-Million Dollar Founder, One Day at a Time" — A high-frequency, glossary-style series where a team member explains one startup-world term per episode (valuation, GTM strategy, cap table, runway) and grounds it in a real example of a company that used it well.',
              },
              {
                type: "labeled",
                label: "One-line hook concept",
                items: [
                  '"One startup term a day, explained in under a minute — with proof it actually works."',
                ],
              },
              {
                type: "labeled",
                label: "Franchise mechanics",
                items: [
                  "\"Day [X]\" numbering is the core visual and psychological hook — countable, collectible, bingeable.",
                  "Each episode stands alone but rewards followers who watch sequentially.",
                  "Over time becomes a searchable, saveable startup glossary — compounding SEO and save value.",
                  "Complements Pack #1: Pack #2 defines terms; Pack #1 applies them to full company stories.",
                ],
              },
            ],
          },
          {
            label: "1.2 Format & Platform",
            blocks: [
              {
                type: "labeled",
                label: "Format",
                items: [
                  "UGC talking-head + whiteboard OR clean slide/graphic visuals.",
                  "Short-form vertical video (9:16).",
                  "Pick one primary visual mode — use the other sparingly for variety only.",
                ],
              },
              {
                type: "labeled",
                label: "Length",
                items: [
                  "Target: 30–60 seconds — shorter than Pack #1 by design.",
                  "Optimized for high frequency and quick consumption.",
                  "If you hit 60s, you have too much — cut an example, not the definition.",
                ],
              },
              {
                type: "labeled",
                label: "Platforms",
                items: [
                  "Instagram Reels — primary.",
                  "TikTok — primary for discovery; slightly faster pacing edit.",
                  "YouTube Shorts — tertiary; term name in title for search (e.g. \"What is Runway? Day 3\").",
                ],
              },
            ],
          },
          {
            label: "1.3 Origin",
            blocks: [
              {
                type: "paragraph",
                text: "Whitespace: competitors either avoid startup education entirely or bury it in long-form content (10+ minute YouTube, blog posts) that doesn't fit short-form scrolling behavior.",
              },
              {
                type: "bullets",
                items: [
                  "Builds a compounding content asset — glossary posts stay relevant for years.",
                  "Lead-gen funnel into Altitut framework — same templates as Pack #1 CTAs.",
                  "Directly complementary to Startup Teardown: companies vs. terms.",
                  "High-performing terms feed back into Pack #1 episodes (e.g. Day 2 GTM → GTM teardown).",
                  "Maintain 30–60 term backlog before launch so team never scrambles day-of.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "strategy",
        title: "2. STRATEGY",
        entries: [
          {
            label: "2.1 What It Promotes",
            blocks: [
              {
                type: "paragraph",
                text: "Founder literacy and Altitut's positioning as the platform that helps people not just build a startup but understand the language of building one.",
              },
              {
                type: "bullets",
                items: [
                  "Indirect funnel into same framework/template offer as Pack #1.",
                  "Cross-series brand consistency — same host voice, same CTA mechanics.",
                  "Positions Altitut as the \"translator\" between startup jargon and real action.",
                  "Every term episode ends with \"learn this inside Altitut\" energy without hard selling.",
                ],
              },
            ],
          },
          {
            label: "2.2 Goal",
            blocks: [
              {
                type: "labeled",
                label: "Primary goal",
                items: [
                  "Awareness — reach people who feel \"behind\" on startup vocabulary.",
                  "Habitual engagement — daily/near-daily cadence builds return viewers.",
                  "\"Day X\" psychology mirrors \"day in the life\" and countdown series mechanics.",
                ],
              },
              {
                type: "labeled",
                label: "Secondary goal",
                items: [
                  "Conversion via comment-keyword CTA (DAY 1, DAY 2, etc.).",
                  "Evergreen search/save value — glossary content never expires.",
                  "Identify which terms drive most lead interest → prioritize deeper content.",
                ],
              },
            ],
          },
          {
            label: "2.3 Who It's For",
            blocks: [
              {
                type: "paragraph",
                text: "Early-stage and aspiring founders who feel behind on \"startup vocabulary\" — want quick, credible, bite-sized education.",
              },
              {
                type: "bullets",
                items: [
                  "Newer to startup world — may not know what a cap table or term sheet is.",
                  "Binge-prone once they discover the series — lean into numbered continuity.",
                  "Not for VCs or experienced operators — definitions must stay plain English.",
                  "Students in entrepreneurship courses — overlaps with Altitut Game audience.",
                  "Content consumers graduating to builders — bridge audience for Altitut signup.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "series",
        title: "3. THE SERIES → WHAT TO MAKE",
        episodes: [
          {
            title: "Day 1 — Valuation",
            entries: [
              {
                label: "3.1.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Day 1: Valuation — What It Actually Means"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "First episode sets the template — highest production care on Day 1.",
                      "\"Day 1\" badge must be prominent on screen entire runtime.",
                      "Angle: demystify a term that intimidates first-time founders.",
                    ],
                  },
                ],
              },
              {
                label: "3.1.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"If you don\'t understand this term, you\'ll get a bad deal in your first raise."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Fear-based hook — concrete consequence, not abstract importance.",
                      "Deliver in first 2 seconds — no logo intro.",
                    ],
                  },
                ],
              },
              {
                label: "3.1.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat flow:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: Plain-English definition — \"valuation = what investors think your company is worth today.\"",
                      "Beat 2: Why it matters at earliest stage — even pre-revenue startups get \"valued.\"",
                      "Beat 3: Real example — one startup with well-documented valuation story (verify facts).",
                      "Beat 4: One-line takeaway — \"Valuation is a story about your future, not your present.\"",
                    ],
                  },
                ],
              },
              {
                label: "3.1.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Comment \'DAY 1\' and I\'ll send you today\'s term as a one-pager."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Deliverable: Valuation one-pager PDF — definition, example, worksheet.",
                      "Also mention in caption: comment 'GLOSSARY' for full list as series grows.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: "Day 2 — Go-To-Market Strategy",
            entries: [
              {
                label: "3.2.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Day 2: Go-To-Market Strategy — The Term Everyone Uses Wrong"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Contrarian angle — \"everyone uses wrong\" creates comment debate.",
                      "GTM is universally misused — high search and save potential.",
                    ],
                  },
                ],
              },
              {
                label: "3.2.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Most founders think GTM means \'marketing.\' It doesn\'t. Here\'s the real definition."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Myth-bust hook — invites agreement AND disagreement in comments.",
                      "Write \"GTM ≠ Marketing\" on screen large.",
                    ],
                  },
                ],
              },
              {
                label: "3.2.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat flow:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: State the common misconception — \"GTM = ads and social media.\"",
                      "Beat 2: Correct definition — \"how you deliver your product to the customer who will pay.\"",
                      "Beat 3: Real company example — one specific GTM choice and why it worked for their audience.",
                      "Beat 4: Takeaway — \"GTM is a bet on one channel, not a list of tactics.\"",
                    ],
                  },
                ],
              },
              {
                label: "3.2.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Comment \'DAY 2\' for the one-pager."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Deliverable: GTM one-pager with definition + channel selection worksheet.",
                      "If engagement high → schedule Pack #1 teardown on same company's GTM.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: "Day 3 — Runway",
            entries: [
              {
                label: "3.3.1 Title / Angle",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Day 3: Runway — The Number That Decides If You Survive"',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Survival framing — urgency without being clickbait.",
                      "Runway is universally relevant from day one — broad appeal.",
                    ],
                  },
                ],
              },
              {
                label: "3.3.2 Hook",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"This is the first number every investor will ask you about."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Authority hook — implies insider investor knowledge.",
                      "Write \"RUNWAY\" large on screen as term reveal.",
                    ],
                  },
                ],
              },
              {
                label: "3.3.3 What It Shows",
                blocks: [
                  {
                    type: "paragraph",
                    text: "Beat-by-beat flow:",
                  },
                  {
                    type: "bullets",
                    items: [
                      "Beat 1: Definition — \"cash in bank ÷ monthly burn = months you have left.\"",
                      "Beat 2: Why it's the single most important early-stage metric.",
                      "Beat 3: Example — startup that extended runway smartly OR cautionary tale of running out.",
                      "Beat 4: Takeaway — \"Runway isn't a number — it's a countdown.\"",
                    ],
                  },
                ],
              },
              {
                label: "3.3.4 CTA",
                blocks: [
                  {
                    type: "paragraph",
                    text: '"Comment \'DAY 3\' for the one-pager."',
                  },
                  {
                    type: "bullets",
                    items: [
                      "Deliverable: Runway calculator one-pager — simple spreadsheet or Notion template.",
                      "Track save rate on this episode — financial terms often get saved most.",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "recipe",
        title: "4. THE RECIPE → HOW TO MAKE",
        entries: [
          {
            label: "4.1 Structure",
            blocks: [
              {
                type: "labeled",
                label: "Hook (0–3s)",
                items: [
                  "State the term like a secret or a warning — urgency/curiosity immediately.",
                  "\"Day [X]\" badge visible from frame one.",
                ],
              },
              {
                type: "labeled",
                label: "Body (3–35s)",
                items: [
                  "Plain-English definition — no jargon in the definition itself.",
                  "Why it matters for a founder specifically — not academic context.",
                  "One real-company example — name the company, name the decision.",
                ],
              },
              {
                type: "labeled",
                label: "Takeaway (35–45s)",
                items: [
                  "One-line, highly quotable distillation of the term.",
                  "Write it on screen — this is the save-worthy frame.",
                ],
              },
              {
                type: "labeled",
                label: "CTA (45–60s)",
                items: [
                  "Comment-the-day-number ask.",
                  "Point down, hold eye contact, don't rush the last 3 seconds.",
                ],
              },
              {
                type: "labeled",
                label: "Target length",
                items: [
                  "30–60 seconds — this series lives on frequency, not depth.",
                ],
              },
            ],
          },
          {
            label: "4.2 Visual Style",
            blocks: [
              {
                type: "bullets",
                items: [
                  "Consistent visual mode per series — whiteboard OR slide graphics, not both week-to-week.",
                  "\"Day [X]\" badge always visible on-screen — single most important franchise element.",
                  "Bold, large typography for the term reveal — one word or phrase, center screen.",
                  "Same color for term text every episode (e.g. Altitut brand blue).",
                  "Keep slides to 3 max per episode — definition, example, takeaway.",
                  "Host face in corner or split screen — human connection matters even on slides.",
                ],
              },
            ],
          },
          {
            label: "4.3 Audio",
            blocks: [
              {
                type: "bullets",
                items: [
                  "Fast-paced direct-to-camera delivery — energetic and quick.",
                  "Upbeat, minimal background music bed.",
                  "Can lean slightly more trend-aware than Pack #1 — snackable tone.",
                  "Do NOT use meme sounds that date the content — glossary must stay evergreen.",
                  "Pace: ~150 words per minute — faster than Pack #1 teardowns.",
                ],
              },
            ],
          },
          {
            label: "4.4 Caption + Hashtags",
            blocks: [
              {
                type: "labeled",
                label: "Caption template",
                items: [
                  "Line 1: Day [X]: [Term]. Here's what it actually means (and who's used it right). 📈",
                  "Line 2: (blank line)",
                  "Line 3: Want the one-pager? Comment 'DAY [X]' 👇",
                  "Line 4: Building the full glossary — comment 'GLOSSARY' to get the whole list as we go.",
                ],
              },
              {
                type: "labeled",
                label: "Hashtag set (5–8 tags)",
                items: [
                  "#StartupTerms",
                  "#FounderLife",
                  "#StartupGlossary",
                  "#BuildInPublic",
                  "#Entrepreneurship",
                  "#StartupTips",
                  "#[Term]Explained (e.g. #ValuationExplained → #RunwayExplained)",
                  "#DayInTheLife",
                ],
              },
              {
                type: "labeled",
                label: "Caption rules",
                items: [
                  "Swap term-specific tag each episode.",
                  "Swap DAY [X] in CTA to match episode number.",
                  "Pin comment with glossary progress: \"12/60 terms explained so far.\"",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "execution",
        title: "5. EXECUTION",
        entries: [
          {
            label: "5.1 Cadence",
            blocks: [
              {
                type: "paragraph",
                text: "Daily or every 2nd–3rd day — the defining feature of this series.",
              },
              {
                type: "bullets",
                items: [
                  "\"Day X\" numbering only works if cadence is reliable and visibly consistent.",
                  "Never skip a day number — if you miss a day, still increment (don't repeat Day 5).",
                  "Batch film 5–10 episodes per session to sustain daily publishing without daily filming.",
                  "If cadence slips below every 3rd day, franchise psychology breaks — protect the schedule.",
                ],
              },
            ],
          },
          {
            label: "5.2 Roles & Effort",
            blocks: [
              {
                type: "labeled",
                label: "On-camera talent",
                items: [
                  "1 team member — consistency helps series recognition (same guidance as Pack #1).",
                  "Can rotate only if building parallel franchises with different hosts.",
                ],
              },
              {
                type: "labeled",
                label: "Research / scripting",
                items: [
                  "Low per episode — definitions are stable/factual.",
                  "Only the company example needs light verification each time.",
                  "Upfront investment: build full 30–60 term bank BEFORE launch.",
                  "Script template: definition (1 sentence) + why (1 sentence) + example (2 sentences) + takeaway (1 sentence).",
                ],
              },
              {
                type: "labeled",
                label: "Filming",
                items: [
                  "Very low production overhead by design.",
                  "Batch 5–10 episodes in one 2-hour session.",
                  "Same lighting setup, same backdrop, same badge template — assembly line.",
                ],
              },
              {
                type: "labeled",
                label: "Difficulty",
                items: [
                  "Low-to-medium — challenge is operational consistency and backlog management, not creative difficulty.",
                ],
              },
            ],
          },
          {
            label: "5.3 What Good Looks Like",
            blocks: [
              {
                type: "paragraph",
                text: "Signals that the glossary franchise is compounding — not just daily views.",
              },
              {
                type: "labeled",
                label: "Primary metric",
                items: [
                  "Save rate — glossary content is meant to be referenced later.",
                  "High saves = format delivers real reference value.",
                ],
              },
              {
                type: "labeled",
                label: "Secondary metrics",
                items: [
                  "CTA keyword-comment volume per episode — which terms drive lead interest?",
                  "Return viewer rate — are same people watching Day 2, Day 3, Day 4?",
                  "GLOSSARY comment volume — demand for compiled asset.",
                ],
              },
              {
                type: "labeled",
                label: "Cross-pack triggers",
                items: [
                  "High-performing term → expand into Pack #1 Startup Teardown episode.",
                  "Example: Day 2 GTM spikes → film \"How [Company] nailed GTM\" teardown.",
                  "Compile top 10 saved terms into a carousel \"Startup Glossary\" lead magnet monthly.",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
