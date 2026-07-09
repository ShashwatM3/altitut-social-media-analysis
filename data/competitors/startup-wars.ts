import type { AnalysisPack } from "../../app/components/pack-panel";

export const STARTUP_WARS_PACK: AnalysisPack = {
  name: "Startup Wars",
  tag: "High Similarity",
  meta: "Tier 1 competitor",
  links: {
    website: "https://www.startupwars.com",
    linkedin: "https://www.linkedin.com/company/startup-wars-inc",
  },
  sections: [
    {
      id: "identity",
      title: "1. IDENTITY",
      entries: [
        {
          label: "1.1 Snapshot",
          blocks: [
            {
              type: "paragraph",
              text: "Startup Wars is a browser-based, gamified startup simulation sold into high school and district entrepreneurship programs. Students launch virtual companies, make MVP and cash-flow decisions, and pivot under pressure — with an AI coach (Milton) and instructor analytics dashboard.",
            },
            {
              type: "bullets",
              items: [
                "Competitive tier: Tier 1 product competitor — strongest match to Altitut's game + course-embedded model.",
                "Buyer vs. user split: Districts/teachers buy; students use — B2B2C education motion.",
                "Websites: startupwars.com (marketing), portal.startupwars.com (product).",
                "Social reality: Extremely weak — Facebook ~124 likes (2026-07-09). Product benchmark, NOT social benchmark.",
                "AI differentiator: Milton AI entrepreneurship coach — parallels Altitut's Alti mentor.",
                "Strategic read: Copy their simulation mechanics and classroom positioning in product content; ignore their social playbook.",
              ],
            },
          ],
        },
        {
          label: "1.2 Positioning",
          blocks: [
            {
              type: "paragraph",
              text: "Startup Wars sells experiential entrepreneurship education for classrooms — learning by running a virtual startup, not reading case studies.",
            },
            {
              type: "bullets",
              items: [
                "Core value prop: \"Students learn entrepreneurship by doing it\" — simulation as curriculum replacement.",
                "Differentiation: Real-time feedback loops + instructor analytics — teachers see student decisions and outcomes.",
                "Industry scenarios: Students pick verticals (tech, food, services) — variety keeps replay value.",
                "Pivot mechanics: Teaches adaptability — aligns with real founder journey.",
                "Positioning vs. Altitut: More institution-first; less consumer-founder-brand energy.",
                "Whitespace: They don't market student founder identity or social proof — Altitut can own the \"student builder\" narrative.",
              ],
            },
          ],
        },
        {
          label: "1.3 Target Audience / ICP",
          blocks: [
            {
              type: "paragraph",
              text: "Primary buyer is the educator; primary user is the student. This shapes all messaging and explains the weak consumer social presence.",
            },
            {
              type: "labeled",
              label: "Primary buyers",
              items: [
                "High school entrepreneurship / business teachers.",
                "District CTE (Career & Technical Education) coordinators.",
                "Curriculum directors seeking digital simulation tools.",
              ],
            },
            {
              type: "labeled",
              label: "Primary users",
              items: [
                "High school students (14–18) in semester-long entrepreneurship courses.",
                "Early college intro to entrepreneurship classes.",
                "Students with zero prior startup exposure.",
              ],
            },
            {
              type: "labeled",
              label: "Who they are NOT targeting",
              items: [
                "Solo adult founders building real startups.",
                "Accelerator cohorts or startup communities.",
                "Self-serve consumer signups via Instagram/TikTok funnels.",
              ],
            },
          ],
        },
        {
          label: "1.4 Similarity to Us",
          blocks: [
            {
              type: "paragraph",
              text: "High structural overlap with Altitut Game + Course layer — lower overlap on consumer social and founder tooling depth.",
            },
            {
              type: "labeled",
              label: "C1 — Product similarity: 8/10",
              items: [
                "Virtual startup simulation ↔ Altitut Game worlds and decision loops.",
                "MVP building inside sim ↔ Altitut MVP builder (real artifacts vs. simulated).",
                "Cash flow / budget management ↔ Altitut funding and business model modules.",
                "AI coach Milton ↔ Alti AI mentor.",
                "Instructor analytics ↔ Altitut Course/LMS instructor dashboard.",
              ],
            },
            {
              type: "labeled",
              label: "C2 — Learning flow similarity: 8/10",
              items: [
                "Sequential decision-making with consequences — both teach through feedback.",
                "Course-embedded deployment — not standalone consumer app.",
                "Gap: Altitut adds real-world tools (interviews, pitch, funding discovery) outside simulation.",
              ],
            },
            {
              type: "labeled",
              label: "C3 — Gamification similarity: 8/10",
              items: [
                "Industry selection, progression, pivot loops — strong game mechanics.",
                "Altitut Game has richer RPG layer (XP, pets, worlds, mini-games) — deeper gamification.",
                "Startup Wars gamification is simulation-realism; Altitut adds narrative RPG on top.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "product",
      title: "2. PRODUCT & WEBSITE",
      entries: [
        {
          label: "2.1 Highlight Features",
          blocks: [
            {
              type: "paragraph",
              text: "Features emphasized on startupwars.com and in sales materials — all classroom-outcome oriented.",
            },
            {
              type: "bullets",
              items: [
                "Multi-industry startup scenarios — students choose business type and market.",
                "MVP development decisions — what to build first, feature tradeoffs.",
                "Customer segment identification — who is the customer, why they buy.",
                "Cash flow and budget management — runway, expenses, revenue simulation.",
                "Pivot mechanics — change direction when metrics fail.",
                "Real-time feedback — immediate consequences to decisions.",
                "Milton AI coach — guidance and entrepreneurship Q&A.",
                "Instructor analytics — teacher dashboard for class progress and outcomes.",
              ],
            },
          ],
        },
        {
          label: "2.2 Most-Attractive Features",
          blocks: [
            {
              type: "paragraph",
              text: "Hero features that close district deals and impress teachers in demos.",
            },
            {
              type: "bullets",
              items: [
                "Consequence-based gameplay — students SEE results of bad decisions (engagement hook for teens).",
                "Instructor analytics — solves teacher pain: \"How do I grade participation?\"",
                "Milton AI — modern differentiator vs. legacy sim software (Capsim, etc.).",
                "No install / browser-based — low IT friction for schools.",
                "Curriculum alignment — fits semester structure with clear modules.",
                "Why they land: Teachers buy tools that reduce prep work AND increase student engagement.",
              ],
            },
          ],
        },
        {
          label: "2.3 Messaging & Conversion",
          blocks: [
            {
              type: "paragraph",
              text: "Website and sales funnel speak to educators, not students or founders on social media.",
            },
            {
              type: "labeled",
              label: "Headline patterns",
              items: [
                "Learning outcomes first: engagement, critical thinking, real-world skills.",
                "Simulation credibility: \"students run a real business\" (virtual).",
                "Standards / curriculum compatibility language.",
              ],
            },
            {
              type: "labeled",
              label: "Conversion funnel",
              items: [
                "Primary CTA: Request demo / contact sales — not self-serve signup.",
                "Long sales cycle: district procurement, teacher trials, semester pilots.",
                "Portal login separate from marketing site — existing customer gateway.",
              ],
            },
            {
              type: "labeled",
              label: "Social proof",
              items: [
                "School/district logos (if shown).",
                "Student outcome testimonials from teachers.",
                "Minimal consumer testimonials or founder stories.",
              ],
            },
          ],
        },
        {
          label: "2.4 Insights to Imbibe",
          blocks: [
            {
              type: "paragraph",
              text: "What Altitut should borrow from Startup Wars' product marketing — especially for instructor-facing content.",
            },
            {
              type: "bullets",
              items: [
                "Tie every game action to a learning outcome teachers can cite.",
                "Show instructor dashboard in social content — B2B2C buyers scroll LinkedIn too.",
                "Use \"decision moment\" clips — 15s clips of pivot or cash-flow crisis in game.",
                "Frame AI mentor as classroom assistant, not replacement for teacher.",
                "Semester-long narrative arcs — \"Week 1 idea → Week 8 pitch\" content series.",
                "Altitut advantage to highlight: Real artifacts (pitch deck, interview notes) not just sim scores.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "social",
      title: "3. SOCIAL PRESENCE",
      entries: [
        {
          label: "3.x.1 Profile Stats",
          blocks: [
            {
              type: "paragraph",
              text: "Startup Wars has one of the weakest social footprints in the competitive set — essentially a placeholder Facebook page.",
            },
            {
              type: "labeled",
              label: "Facebook — facebook.com/startupwarsapp",
              items: [
                "~124 page likes (snapshot 2026-07-09).",
                "Likely dormant or infrequent posting.",
                "Audience: mix of early adopters, teachers, and company updates.",
              ],
            },
            {
              type: "labeled",
              label: "LinkedIn / Instagram / TikTok / YouTube",
              items: [
                "No meaningful verified presence found in competitor research.",
                "Do not waste scrape pipeline resources here until accounts are discovered.",
                "Treat as product-only competitor for social intelligence purposes.",
              ],
            },
          ],
        },
        {
          label: "3.x.2 Cadence & Consistency",
          blocks: [
            {
              type: "paragraph",
              text: "Posting cadence is effectively nil — no reliable content rhythm to model.",
            },
            {
              type: "bullets",
              items: [
                "Facebook: Estimated <1 post per month, possibly seasonal (back-to-school).",
                "No evidence of content calendar or series franchises.",
                "Announcements likely tied to product updates or conference appearances only.",
                "Implication: Altitut has open field — no competitor owns \"student startup simulation\" on social.",
                "Opportunity: Be the FIRST to post consistently in this niche — category creator advantage.",
              ],
            },
          ],
        },
        {
          label: "3.x.3 Format Mix",
          blocks: [
            {
              type: "paragraph",
              text: "Insufficient content volume for meaningful format analysis — directional only.",
            },
            {
              type: "bullets",
              items: [
                "Expected formats if posting: product screenshots, conference photos, press releases.",
                "No reels, carousels, or educational series detected.",
                "100% institutional tone — no UGC, no student faces, no hooks.",
                "Altitut contrast: Lead with student-generated content and game clips.",
              ],
            },
          ],
        },
        {
          label: "3.x.4 Engagement Rate",
          blocks: [
            {
              type: "paragraph",
              text: "Engagement is negligible — low likes, near-zero comments on available posts.",
            },
            {
              type: "bullets",
              items: [
                "Normalized engagement irrelevant at ~124 followers — sample size too small.",
                "Posts likely reach existing customers only — no organic discovery.",
                "No viral content, no save-worthy educational posts.",
                "Lesson: Great product + zero social = missed category awareness.",
                "Altitut at 700–1K users can surpass their entire social reach within 90 days of consistent posting.",
              ],
            },
          ],
        },
        {
          label: "3.x.5 Growth Velocity",
          blocks: [
            {
              type: "paragraph",
              text: "Social follower growth is flat or declining — growth happens through school sales, not social.",
            },
            {
              type: "bullets",
              items: [
                "Facebook likes stagnant — no growth engine.",
                "No cross-platform funnel feeding awareness.",
                "Product growth decoupled from social metrics entirely.",
                "Altitut should NOT replicate this decoupling — social is Altitut's growth lever at current stage.",
                "Action: Snapshot Facebook monthly as baseline \"competitor floor\" metric.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "content",
      title: "4. CONTENT STRATEGY",
      entries: [
        {
          label: "4.1 Content Pillars / Themes",
          blocks: [
            {
              type: "paragraph",
              text: "Where Startup Wars WOULD post if they had a strategy — inferred from product positioning, not observed behavior.",
            },
            {
              type: "bullets",
              items: [
                "Student learning outcomes — grades, engagement, skill development.",
                "Classroom implementation — how teachers run the sim in a semester.",
                "Simulation scenarios — industry highlights, decision moments.",
                "Teacher enablement — lesson plans, rubrics, analytics walkthroughs.",
                "Edtech credibility — conferences, awards, district partnerships.",
                "None of these are currently executed on social at meaningful volume.",
              ],
            },
          ],
        },
        {
          label: "4.2 Recurring Series / Franchises",
          blocks: [
            {
              type: "paragraph",
              text: "No recurring social franchises exist — complete whitespace for Altitut.",
            },
            {
              type: "bullets",
              items: [
                "Missing: \"Student founder of the week\" spotlight series.",
                "Missing: \"Pivot or perish\" decision clip franchise.",
                "Missing: \"Teacher tip Tuesday\" classroom implementation series.",
                "Missing: \"Milton vs. Alti\" AI coach comparison content (Altitut can own this narrative).",
                "Missing: Semester timeline content — Week 1 vs. Week 12 student progress.",
                "Altitut action: Launch these franchises FIRST and own the category keywords.",
              ],
            },
          ],
        },
        {
          label: "4.3 Hook Patterns",
          blocks: [
            {
              type: "paragraph",
              text: "No hook data available — recommended hooks Altitut can use targeting Startup Wars' audience overlap.",
            },
            {
              type: "labeled",
              label: "Student-facing hooks",
              items: [
                "\"Your business class simulation just got an upgrade.\"",
                "\"What happens when your startup runs out of cash in week 3?\"",
                "\"Build a startup in class — for real, not just a worksheet.\"",
              ],
            },
            {
              type: "labeled",
              label: "Teacher-facing hooks",
              items: [
                "\"Grade entrepreneurship without grading essays.\"",
                "\"See every student's startup decisions in one dashboard.\"",
                "\"The simulation your district actually asked for.\"",
              ],
            },
          ],
        },
        {
          label: "4.4 CTA / Funnel Intent",
          blocks: [
            {
              type: "paragraph",
              text: "Startup Wars funnel is demo-request → pilot → district contract. Social plays zero role today.",
            },
            {
              type: "bullets",
              items: [
                "B2B CTA: \"Request a demo for your classroom.\"",
                "No comment-to-DM, no lead magnets, no student self-serve funnel.",
                "Altitut dual funnel opportunity: Student viral content → teacher inbound OR direct instructor outreach.",
                "Use \"Try Altitut Game free\" as consumer CTA alongside \"Book a classroom demo.\"",
                "Content should serve BOTH funnels — reels for students, carousels for teachers.",
              ],
            },
          ],
        },
        {
          label: "4.5 Brand Voice / Tone",
          blocks: [
            {
              type: "paragraph",
              text: "Institutional, practical, outcome-driven — educator-friendly, student-distant.",
            },
            {
              type: "bullets",
              items: [
                "Formal edtech register — avoids slang, memes, or founder Twitter tone.",
                "Third-person company voice — no recognizable founder face.",
                "Feature-spec language common in sales decks.",
                "Safe and district-approved — no controversial takes.",
                "Altitut opportunity: Same classroom credibility PLUS student-native voice on TikTok/Reels.",
              ],
            },
          ],
        },
        {
          label: "4.6 Production Style",
          blocks: [
            {
              type: "paragraph",
              text: "Minimal production — screenshots and stock-style imagery when they post at all.",
            },
            {
              type: "bullets",
              items: [
                "Low-friction visuals — product UI captures, not produced video.",
                "No talking head, no student testimonials on video.",
                "Conference booth photos as primary \"human\" content.",
                "Altitut bar to beat: Phone-recorded game footage + student reaction clips.",
                "Production quality is NOT the barrier — consistency and personality are.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "top-performers",
      title: "5. TOP PERFORMERS",
      entries: [
        {
          label: "5.x.1 The Content",
          blocks: [
            {
              type: "paragraph",
              text: "No verified top performers — below are inferred post types that WOULD resonate with their audience if they posted.",
            },
            {
              type: "labeled",
              label: "Hypothetical Post A — Student outcome snapshot",
              items: [
                "Format: Static image — student dashboard with revenue graph.",
                "Caption: \"Ms. Johnson's class grew their virtual startups 300% in 6 weeks.\"",
                "Audience: Teachers considering adoption.",
              ],
            },
            {
              type: "labeled",
              label: "Hypothetical Post B — Pivot decision clip",
              items: [
                "Format: 30s screen recording of pivot moment in sim.",
                "Hook: \"This student almost went bankrupt. Then they pivoted.\"",
                "Audience: Students + teachers.",
              ],
            },
            {
              type: "labeled",
              label: "Hypothetical Post C — Teacher testimonial",
              items: [
                "Format: Quote graphic from teacher.",
                "Copy: \"Finally a tool that makes entrepreneurship tangible.\"",
                "Audience: District buyers.",
              ],
            },
          ],
        },
        {
          label: "5.x.2 The Numbers",
          blocks: [
            {
              type: "paragraph",
              text: "Insufficient data for real metrics — use as competitive floor, not target.",
            },
            {
              type: "bullets",
              items: [
                "Facebook posts likely receive single-digit to low tens of likes.",
                "Comments: near zero on most posts.",
                "Shares: negligible.",
                "No saves, no viral distribution.",
                "Altitut target: Exceed their best-ever post engagement within first month of posting.",
                "Once scraping confirms, replace this section with actual top 10 post data.",
              ],
            },
          ],
        },
        {
          label: "5.x.3 Why It Won",
          blocks: [
            {
              type: "paragraph",
              text: "N/A for current social — instead, why the CONTENT TYPES above would win if executed.",
            },
            {
              type: "bullets",
              items: [
                "Concrete classroom outcomes beat abstract product claims.",
                "Decision drama (pivot, bankruptcy) creates narrative tension students share.",
                "Teacher social proof reduces adoption risk for buyers.",
                "Formula for Altitut: Student drama clip + teacher outcome stat + soft demo CTA.",
                "Repeatable: One student story per week = 52 annual content pieces.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "paid",
      title: "6. PAID & PARTNERSHIPS",
      entries: [
        {
          label: "6.1 Active Ads",
          blocks: [
            {
              type: "paragraph",
              text: "No evidence of active consumer social ads — paid spend likely targets education conferences and direct sales.",
            },
            {
              type: "bullets",
              items: [
                "Meta Ad Library: likely empty or minimal for startupwars.com.",
                "Probable paid channels: Google Ads for \"entrepreneurship simulation classroom\" keywords.",
                "Conference sponsorships: CTE and edtech events.",
                "No Instagram/TikTok ad creative detected.",
                "Altitut action: Search Ad Library + Google transparency — document if anything appears.",
                "Whitespace: Run targeted ads to entrepreneurship teachers while competitor doesn't.",
              ],
            },
          ],
        },
        {
          label: "6.2 Partnerships",
          blocks: [
            {
              type: "paragraph",
              text: "Partnerships are institutional — district deals, curriculum networks, edtech resellers.",
            },
            {
              type: "bullets",
              items: [
                "School district and CTE program partnerships (primary channel).",
                "Curriculum integrators and education technology cooperatives.",
                "Possible state-level procurement contracts.",
                "No influencer, creator, or student ambassador programs visible.",
                "No university entrepreneurship center partnerships detected.",
                "Altitut opportunity: Partner with university incubators AND high school programs — broader than Startup Wars.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "audience",
      title: "7. AUDIENCE & COMMUNITY",
      entries: [
        {
          label: "7.1 Sentiment",
          blocks: [
            {
              type: "paragraph",
              text: "Limited public sentiment — teachers who adopt likely positive; no vocal online community.",
            },
            {
              type: "labeled",
              label: "Expected praise",
              items: [
                "Students engaged more than with textbooks.",
                "Analytics make grading entrepreneurship easier.",
                "Scenarios feel relevant to real business decisions.",
              ],
            },
            {
              type: "labeled",
              label: "Potential complaints",
              items: [
                "Learning curve for teachers on first deployment.",
                "Simulation vs. real-world building — some want more tangible outputs.",
                "Pricing transparency for small schools.",
              ],
            },
          ],
        },
        {
          label: "7.2 Whitespace",
          blocks: [
            {
              type: "paragraph",
              text: "Massive gaps Startup Wars leaves open — Altitut can dominate these in content.",
            },
            {
              type: "bullets",
              items: [
                "Student founder identity content — teens building real things, not just sim scores.",
                "Social-native marketing to students who influence teacher tool choices.",
                "Pitch practice, funding, interviews — real-world skills beyond simulation.",
                "Altitut Game RPG narrative — more engaging than spreadsheet-style sim UI.",
                "Community and leaderboard content — competitive student engagement.",
                "Parent and counselor audience — untapped distribution channel.",
              ],
            },
          ],
        },
        {
          label: "7.3 Responsiveness",
          blocks: [
            {
              type: "paragraph",
              text: "No meaningful public comment engagement to analyze.",
            },
            {
              type: "bullets",
              items: [
                "Facebook page likely unmonitored for comments.",
                "Support probably routed through email/sales, not social DMs.",
                "Altitut standard: Be the responsive brand in a category where competitor is silent.",
                "Reply to every teacher and student comment — build reputation moat.",
              ],
            },
          ],
        },
        {
          label: "7.4 Owned Community",
          blocks: [
            {
              type: "paragraph",
              text: "Community exists inside classrooms, not online — no Discord, no public student forum.",
            },
            {
              type: "bullets",
              items: [
                "In-class peer competition — students compare virtual company performance.",
                "Teacher professional networks (Facebook groups for entrepreneurship educators) — indirect community.",
                "No student-facing Discord, subreddit, or TikTok community.",
                "Portal login — walled garden, no social features visible externally.",
                "Altitut opportunity: Build public student founder community competitor lacks entirely.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "synthesis",
      title: "8. SYNTHESIS",
      entries: [
        {
          label: "8.1 Winning Formula",
          blocks: [
            {
              type: "paragraph",
              text: "Startup Wars wins on product-classroom fit, NOT on social or brand.",
            },
            {
              type: "bullets",
              items: [
                "One-line formula: \"Gamified sim + AI coach + teacher analytics + district sales.\"",
                "Zero social formula — growth is sales-led.",
                "Product does the teaching; marketing does the district demo.",
              ],
            },
          ],
        },
        {
          label: "8.2 Recent Strategic Shifts",
          blocks: [
            {
              type: "paragraph",
              text: "Directional — verify on product updates and press.",
            },
            {
              type: "bullets",
              items: [
                "AI coach (Milton) added — following edtech AI trend.",
                "Possible analytics dashboard enhancements for teachers.",
                "No visible pivot toward consumer social marketing.",
                "Watch for: partnership announcements with large districts.",
              ],
            },
          ],
        },
        {
          label: "8.3 Steal / Avoid / Test",
          blocks: [
            {
              type: "labeled",
              label: "Steal",
              items: [
                "Decision-scenario game loops with immediate feedback.",
                "Instructor analytics as sales proof point.",
                "Industry variety in simulation scenarios.",
                "Semester-structured curriculum alignment.",
              ],
            },
            {
              type: "labeled",
              label: "Avoid",
              items: [
                "Ignoring social entirely — their weakness is Altitut's opportunity.",
                "Institution-only voice on student channels.",
                "Demo-only funnel with no self-serve try path.",
              ],
            },
            {
              type: "labeled",
              label: "Test",
              items: [
                "Weekly student founder showcase reels from Altitut Game.",
                "Teacher dashboard walkthrough carousels.",
                "\"Pivot or perish\" 30s game decision clips.",
                "Classroom pilot case study posts.",
              ],
            },
          ],
        },
        {
          label: "8.4 Hooks into Content Packs",
          blocks: [
            {
              type: "paragraph",
              text: "Feeds into Altitut Content Packs — especially game clips and teardown angles.",
            },
            {
              type: "bullets",
              items: [
                "Startup Teardown: Teardown edtech sim companies' GTM (how Startup Wars sells to districts).",
                "Glossary series: Terms like CAC, runway, pivot — taught via game scenarios.",
                "Hooks: \"Pivot or perish\", \"MVP budget tradeoffs\", \"simulation decision points\".",
                "Student POV content Altitut can produce that Startup Wars never will.",
                "Cross-pack: Game clip → glossary term → teardown of real company using same concept.",
              ],
            },
          ],
        },
      ],
    },
  ],
};
