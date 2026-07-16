/** Client-safe guide sections shown in the Help dialog (mirrors docs/PLATFORM-GUIDE.md). */

export const PLATFORM_GUIDE_TITLE =
  "Social Media Command Center — Platform Guide";

export const PLATFORM_GUIDE_SECTIONS: {
  id: string;
  title: string;
  body: string;
}[] = [
  {
    id: "what-for",
    title: "What this platform is for",
    body: `There are two jobs:

1. **Competitors Analysis** — read structured intelligence packs on competitors, ask the competitor copilot questions, and run Competitor Scout to research a new competitor automatically.
2. **Content Creation** — browse content packs (transferable reel playbooks) the social team can execute. New packs arrive from the Telegram reel bot.

Live data comes from Firestore. If Firestore is unreachable, the app falls back to the packs shipped in the repo so the UI still works.`,
  },
  {
    id: "layout",
    title: "Layout overview",
    body: `- **Header** — title plus **Help ?** (this guide and the help assistant).
- **Left nav** — switch between **Competitors Analysis** and **Content Creation**.
- **Main pane** — tools and packs for the active tab.`,
  },
  {
    id: "competitors",
    title: "Competitors Analysis",
    body: `### Reading a competitor pack

Each competitor pack includes a TL;DR plus eight structured sections (identity, product, social presence, content strategy, top performers, paid, audience, verdict). Expand sections to dig into bullets, quotes, and tables.

### Ask the competitor copilot

The chat at the top of this tab uses RAG over competitor packs, content packs, and Altitut product context. Ask natural-language strategy questions (compare competitors, find threats, content whitespace). It is **not** for dashboard how-to questions — use the help assistant for those.

### Run Competitor Scout

Click **Run Competitor Scout**, confirm the Altitut product description, and submit. The scout discovers a candidate, verifies the website, maps socials, researches deeply, synthesizes the 8-section pack, then saves it to Firestore and the knowledge base. Leave the progress dialog open until it finishes; you can retry a failed step.`,
  },
  {
    id: "content",
    title: "Content Creation",
    body: `Content packs are transferable playbooks built from strong Instagram reels (understanding the reel → transfer plan → production recipes).

New packs are **not** created in the web UI. Send an Instagram reel URL to the Telegram content-pack bot; after scrape → Whisper → vision analysis → synthesis, the pack appears live on this tab.`,
  },
  {
    id: "help",
    title: "Help ? and the help assistant",
    body: `**Help ?** opens this guide. **Ask the help assistant** answers how-to questions with RAG over the platform guide only.

- Platform usage → Help assistant
- Competitor / strategy questions → competitor copilot on the Competitors tab`,
  },
  {
    id: "faq",
    title: "Quick FAQ",
    body: `**Add a competitor?** Run Competitor Scout on the Competitors Analysis tab.

**Add a content pack?** Send a reel link to the configured Telegram bot.

**Pack missing after save?** Wait for the live Firestore listener, then refresh. If Firestore is down you only see static fallback packs.

**What is Altitut?** An entrepreneurship-education platform (web app + game) that teaches students and early founders how to build startups.`,
  },
];
