import type {
  AnalysisPack,
  PackLinks,
  PackSection,
} from "../app/components/pack-panel";
import { scrapeInstagramProfiles } from "./apify";
import { exaContents, exaSearch } from "./exa";
import { completeJson } from "./openai";
import { normalizeLinks, normalizeSection } from "./packs";

/* ------------------------------------------------------------------ */
/* Workflow state — serialized between client-driven steps             */
/* ------------------------------------------------------------------ */

export type ScoutCandidate = {
  name: string;
  website: string;
  whyChosen: string;
  links: PackLinks;
};

export type ScoutState = {
  productDescription: string;
  existingNames: string[];
  candidate?: ScoutCandidate;
  alternates?: { name: string; website: string }[];
  websiteDigest?: string;
  socialDigest?: string;
  researchDigest?: string;
  sections?: PackSection[];
  tldr?: string;
  tag?: string;
  meta?: string;
};

const DIGEST_LIMIT = 12000;

function clip(text: string, limit = DIGEST_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit)}\n…[truncated]` : text;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Step 1 — Discover candidates (Exa company search + LLM selection)   */
/* ------------------------------------------------------------------ */

export async function stepDiscover(state: ScoutState): Promise<ScoutState> {
  const { productDescription, existingNames } = state;
  const queries = [
    `platforms similar to: ${productDescription.slice(0, 300)}`,
    "gamified entrepreneurship education platform for students and early founders",
    "startup simulation learning platform customer discovery pitch practice software",
  ];
  const resultsPerQuery = await Promise.all(
    queries.map((query) =>
      exaSearch(query, {
        numResults: 10,
        category: "company",
        includeText: true,
        maxCharacters: 1200,
      }).catch(() => []),
    ),
  );
  const seen = new Set<string>();
  const candidates = resultsPerQuery
    .flat()
    .filter((result) => {
      const domain = domainOf(result.url);
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    })
    .slice(0, 24);

  if (candidates.length === 0) {
    throw new Error("Exa returned no company candidates — try again.");
  }

  const selection = await completeJson<{
    name: string;
    website: string;
    why_chosen: string;
    alternates: { name: string; website: string }[];
  }>({
    system:
      "You select the single best NEW competitor for a competitive-intelligence pack. " +
      "A good competitor matches the product pattern closely (entrepreneurship education / startup-building platform for students or early founders, ideally gamified or AI-assisted). " +
      "Exclude accelerators, VC funds, news sites, marketplaces, and anything already tracked. " +
      "Respond with JSON: {\"name\", \"website\", \"why_chosen\", \"alternates\": [{\"name\", \"website\"}]} (2-4 alternates, ranked).",
    user:
      `OUR PRODUCT:\n${productDescription}\n\n` +
      `ALREADY-TRACKED COMPETITORS (never pick these): ${existingNames.join(", ") || "none"}\n\n` +
      `CANDIDATES FOUND VIA LIVE WEB SEARCH:\n` +
      candidates
        .map(
          (candidate, index) =>
            `${index + 1}. ${candidate.title ?? domainOf(candidate.url)} — ${candidate.url}\n${(candidate.text ?? "").slice(0, 600)}`,
        )
        .join("\n\n"),
  });

  if (!selection.website || !selection.name) {
    throw new Error("Could not select a competitor from search results.");
  }
  const existingLower = existingNames.map((name) => name.toLowerCase());
  if (existingLower.some((name) => selection.name.toLowerCase().includes(name) || name.includes(selection.name.toLowerCase()))) {
    const fallback = selection.alternates?.find(
      (alternate) =>
        !existingLower.some((name) => alternate.name.toLowerCase().includes(name)),
    );
    if (fallback) {
      selection.name = fallback.name;
      selection.website = fallback.website;
      selection.why_chosen = "Chosen as best untracked alternate.";
    }
  }

  return {
    ...state,
    candidate: {
      name: selection.name,
      website: selection.website,
      whyChosen: selection.why_chosen ?? "",
      links: { website: selection.website },
    },
    alternates: selection.alternates ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Step 2 — Crawl website & product pages                              */
/* ------------------------------------------------------------------ */

const SOCIAL_PATTERNS: [keyof PackLinks | "x", RegExp][] = [
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?/g],
  ["linkedin", /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[A-Za-z0-9_-]+\/?/g],
  ["twitter", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+\/?/g],
];

async function extractSocialLinks(websiteUrl: string): Promise<PackLinks> {
  const links: PackLinks = {};
  try {
    const response = await fetch(websiteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AltitutScout/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    for (const [key, pattern] of SOCIAL_PATTERNS) {
      const match = html.match(pattern);
      if (match && match[0]) {
        const url = match[0];
        // Skip share-intent links.
        if (/intent|share|sharer/i.test(url)) continue;
        if (key === "x") {
          links.twitter = links.twitter ?? url;
        } else {
          links[key] = links[key] ?? url;
        }
      }
    }
  } catch {
    // Site unreachable — social discovery falls back to Exa in step 3.
  }
  return links;
}

export async function stepWebsite(state: ScoutState): Promise<ScoutState> {
  const candidate = state.candidate;
  if (!candidate) throw new Error("No candidate selected yet.");

  const [homepage, socialLinks, productPages] = await Promise.all([
    exaContents([candidate.website], 8000).catch(() => []),
    extractSocialLinks(candidate.website),
    exaSearch(`${candidate.name} product features pricing how it works`, {
      numResults: 5,
      includeText: true,
      maxCharacters: 2000,
      includeDomains: [domainOf(candidate.website)],
    }).catch(() => []),
  ]);

  const digest = [
    `HOMEPAGE (${candidate.website}):`,
    homepage[0]?.text ?? "(homepage text unavailable)",
    "",
    "OTHER PAGES ON THEIR SITE:",
    ...productPages.map(
      (page) => `— ${page.title ?? page.url} (${page.url})\n${page.text ?? ""}`,
    ),
  ].join("\n");

  return {
    ...state,
    candidate: {
      ...candidate,
      links: { ...socialLinks, website: candidate.website },
    },
    websiteDigest: clip(digest),
  };
}

/* ------------------------------------------------------------------ */
/* Step 3 — Map social presence (Apify Instagram + Exa lookups)        */
/* ------------------------------------------------------------------ */

function instagramUsername(url: string): string | null {
  const match = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
  const username = match?.[1];
  if (!username || ["p", "reel", "reels", "explore", "stories"].includes(username)) {
    return null;
  }
  return username;
}

/** Loose brand-match guard so we don't scrape an unrelated account. */
function handleMatchesBrand(handle: string, name: string, website: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanHandle = normalize(handle);
  const brandTokens = [normalize(name), normalize(domainOf(website).split(".")[0])];
  return brandTokens.some(
    (token) =>
      token.length >= 4 &&
      (cleanHandle.includes(token.slice(0, Math.min(token.length, 8))) ||
        token.includes(cleanHandle.slice(0, Math.min(cleanHandle.length, 8)))),
  );
}

export async function stepSocial(state: ScoutState): Promise<ScoutState> {
  const candidate = state.candidate;
  if (!candidate) throw new Error("No candidate selected yet.");
  const notes: string[] = [];

  // Instagram — hard numbers via Apify when a profile is known.
  if (candidate.links.instagram) {
    const username = instagramUsername(candidate.links.instagram);
    if (username) {
      try {
        const [profile] = await scrapeInstagramProfiles([username]);
        if (profile) {
          const latestPosts = Array.isArray(profile.latestPosts)
            ? (profile.latestPosts as Record<string, unknown>[])
            : [];
          notes.push(
            `INSTAGRAM @${username} (live Apify scrape):`,
            `followers=${profile.followersCount ?? "?"} following=${profile.followsCount ?? "?"} posts=${profile.postsCount ?? "?"} verified=${profile.verified ?? "?"}`,
            `bio: ${profile.biography ?? ""}`,
            ...latestPosts.slice(0, 8).map((post, index) => {
              const caption = String(post.caption ?? "").slice(0, 200);
              return `post ${index + 1}: type=${post.type ?? "?"} likes=${post.likesCount ?? "?"} comments=${post.commentsCount ?? "?"} ts=${post.timestamp ?? "?"} caption="${caption}"`;
            }),
          );
        }
      } catch (error) {
        notes.push(
          `INSTAGRAM: profile found (${candidate.links.instagram}) but live scrape failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } else {
    // Try to find an Instagram profile via Exa.
    try {
      const results = await exaSearch(
        `${candidate.name} ${domainOf(candidate.website)} instagram profile`,
        { numResults: 3, includeDomains: ["instagram.com"], includeText: true, maxCharacters: 600 },
      );
      const profileResult = results.find((result) => {
        const username = instagramUsername(result.url);
        return (
          username && handleMatchesBrand(username, candidate.name, candidate.website)
        );
      });
      if (profileResult) {
        const username = instagramUsername(profileResult.url)!;
        candidate.links.instagram = `https://www.instagram.com/${username}/`;
        notes.push(
          `INSTAGRAM: discovered profile https://www.instagram.com/${username}/ (via ${profileResult.url})`,
          profileResult.text ?? "",
        );
      } else {
        notes.push("INSTAGRAM: no profile found — treat as absent/unverified.");
      }
    } catch {
      notes.push("INSTAGRAM: search failed — treat as unverified.");
    }
  }

  // LinkedIn / X / YouTube / TikTok — best-effort textual snapshots via Exa.
  const lookups: [string, string[]][] = [
    ["LINKEDIN", ["linkedin.com"]],
    ["X-TWITTER", ["x.com", "twitter.com"]],
    ["YOUTUBE", ["youtube.com"]],
    ["TIKTOK", ["tiktok.com"]],
  ];
  const lookupResults = await Promise.all(
    lookups.map(async ([label, domains]) => {
      try {
        const results = await exaSearch(
          `${candidate.name} ${domainOf(candidate.website)} official profile`,
          { numResults: 2, includeDomains: domains, includeText: true, maxCharacters: 900 },
        );
        if (results.length === 0) {
          return `${label}: no profile found — treat as absent/unverified.`;
        }
        return results
          .map((result) => `${label}: ${result.url}\n${result.text ?? ""}`)
          .join("\n");
      } catch {
        return `${label}: lookup failed — treat as unverified.`;
      }
    }),
  );
  notes.push(...lookupResults);

  // Backfill links bar from discovered profiles.
  for (const line of lookupResults) {
    const linkedinMatch = line.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[A-Za-z0-9_-]+/);
    if (linkedinMatch && !candidate.links.linkedin) {
      candidate.links.linkedin = linkedinMatch[0];
    }
    const twitterMatch = line.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/);
    if (twitterMatch && !candidate.links.twitter && !/intent|share/i.test(twitterMatch[0])) {
      candidate.links.twitter = twitterMatch[0];
    }
  }

  return { ...state, candidate, socialDigest: clip(notes.join("\n\n")) };
}

/* ------------------------------------------------------------------ */
/* Step 4 — Deep research: news, reviews, ads, community               */
/* ------------------------------------------------------------------ */

export async function stepResearch(state: ScoutState): Promise<ScoutState> {
  const candidate = state.candidate;
  if (!candidate) throw new Error("No candidate selected yet.");
  const name = candidate.name;
  const domain = domainOf(candidate.website);

  const research: [string, Promise<string>][] = [
    [
      "NEWS & FUNDING",
      exaSearch(`${name} ${domain} startup news funding launch announcement`, {
        numResults: 5,
        includeText: true,
        maxCharacters: 1200,
      }).then((results) =>
        results.map((result) => `— ${result.title} (${result.url}, ${result.publishedDate ?? "n.d."})\n${result.text ?? ""}`).join("\n\n"),
      ),
    ],
    [
      "REVIEWS & USER SENTIMENT",
      exaSearch(`${name} reviews what users say pros cons`, {
        numResults: 6,
        includeText: true,
        maxCharacters: 1200,
        includeDomains: [
          "g2.com",
          "capterra.com",
          "trustpilot.com",
          "reddit.com",
          "producthunt.com",
        ],
      }).then((results) =>
        results.length > 0
          ? results.map((result) => `— ${result.title} (${result.url})\n${result.text ?? ""}`).join("\n\n")
          : "No third-party reviews found on G2/Capterra/Trustpilot/Reddit/Product Hunt — treat sentiment as unverified.",
      ),
    ],
    [
      "CONTENT & MARKETING FOOTPRINT",
      exaSearch(`${name} content marketing strategy blog series social media posts`, {
        numResults: 5,
        includeText: true,
        maxCharacters: 1200,
      }).then((results) =>
        results.map((result) => `— ${result.title} (${result.url})\n${result.text ?? ""}`).join("\n\n"),
      ),
    ],
    [
      "PARTNERSHIPS, ADS & DISTRIBUTION",
      exaSearch(`${name} partnership collaboration ambassador program advertising`, {
        numResults: 5,
        includeText: true,
        maxCharacters: 1000,
      }).then((results) =>
        results.map((result) => `— ${result.title} (${result.url})\n${result.text ?? ""}`).join("\n\n"),
      ),
    ],
  ];

  const settled = await Promise.all(
    research.map(async ([label, promise]) => {
      try {
        const text = await promise;
        return `### ${label}\n${text || "(nothing found)"}`;
      } catch (error) {
        return `### ${label}\n(lookup failed: ${error instanceof Error ? error.message : String(error)})`;
      }
    }),
  );

  return { ...state, researchDigest: clip(settled.join("\n\n"), 16000) };
}

/* ------------------------------------------------------------------ */
/* Steps 5-7 — Synthesis into the eight-section pack format            */
/* ------------------------------------------------------------------ */

const BLOCK_FORMAT_RULES = `Each section is {"id", "title", "entries": [{"label", "blocks"}]}.
Each block is ONE of:
  {"type": "paragraph", "text": "..."} — a short framing paragraph
  {"type": "bullets", "items": ["...", "..."]} — 4-7 substantive bullets
  {"type": "labeled", "label": "Group name", "items": ["...", "..."]} — a labeled bullet group
Entry pattern used across the dashboard: one opening paragraph block, then one or two bullets/labeled blocks.
Every bullet must be a full, specific sentence with real facts from the research — never generic filler.
When the research does not verify something, say so explicitly in the bullet (e.g. "Directional — verify via scrape" / "No verified account found"), exactly like an honest analyst would. Do NOT invent follower counts, revenue, or quotes.
Where relevant, end entries with an actionable "Altitut" takeaway bullet.`;

function synthesisContext(state: ScoutState): string {
  const candidate = state.candidate!;
  return [
    `COMPETITOR: ${candidate.name} (${candidate.website})`,
    `WHY CHOSEN: ${candidate.whyChosen}`,
    `KNOWN LINKS: ${JSON.stringify(candidate.links)}`,
    "",
    "=== ALTITUT (OUR PRODUCT) ===",
    state.productDescription,
    "",
    "=== WEBSITE RESEARCH ===",
    state.websiteDigest ?? "(none)",
    "",
    "=== SOCIAL PRESENCE RESEARCH ===",
    state.socialDigest ?? "(none)",
    "",
    "=== DEEP RESEARCH (news, reviews, content, partnerships) ===",
    state.researchDigest ?? "(none)",
  ].join("\n");
}

function parseSections(parsed: unknown, expectedIds: string[]): PackSection[] {
  const raw = (parsed as Record<string, unknown>)?.sections;
  if (!Array.isArray(raw)) {
    throw new Error("missing sections array");
  }
  const sections = raw
    .map(normalizeSection)
    .filter((section): section is PackSection => section !== null);
  if (sections.length < expectedIds.length) {
    throw new Error(
      `expected ${expectedIds.length} sections (${expectedIds.join(", ")}), got ${sections.length}`,
    );
  }
  return sections;
}

const SYNTHESIS_SYSTEM =
  "You are a senior competitive-intelligence analyst producing a structured competitor pack for Altitut's Social Media Command Center. " +
  "You write dense, specific, honest analysis in the exact JSON structure requested. " +
  BLOCK_FORMAT_RULES;

export async function stepSynthesizeIdentity(state: ScoutState): Promise<ScoutState> {
  const parsed = await completeJson<unknown>({
    system: SYNTHESIS_SYSTEM,
    user:
      `${synthesisContext(state)}\n\n` +
      `Produce JSON {"sections": [...]} with EXACTLY these two sections:\n` +
      `1) id "identity", title "1. IDENTITY", entries labeled: "1.1 Snapshot" (one-liner, competitive tier, buyer/user split, websites, social reality, strategic read), "1.2 Positioning" (value prop, differentiation, whitespace vs Altitut), "1.3 Target Audience / ICP" (use labeled blocks: "Primary buyers"/"Primary users"/"Who they are NOT targeting" or similar), "1.4 Similarity to Us" (labeled blocks scoring "C1 — Product similarity: N/10", "C2 — Learning flow similarity: N/10", "C3 — Gamification similarity: N/10" with rationale bullets comparing to Altitut's features).\n` +
      `2) id "product", title "2. PRODUCT & WEBSITE", entries labeled: "2.1 Highlight Features", "2.2 Most-Attractive Features", "2.3 Messaging & Conversion" (labeled blocks like "Headline patterns"/"Conversion funnel"/"Social proof"), "2.4 Insights to Imbibe" (what Altitut should borrow).`,
    maxOutputTokens: 8000,
    validate: (value) => parseSections(value, ["identity", "product"]),
  });
  return { ...state, sections: [...(state.sections ?? []), ...(parsed as PackSection[])] };
}

export async function stepSynthesizeSocial(state: ScoutState): Promise<ScoutState> {
  const parsed = await completeJson<unknown>({
    system: SYNTHESIS_SYSTEM,
    user:
      `${synthesisContext(state)}\n\n` +
      `Produce JSON {"sections": [...]} with EXACTLY these three sections:\n` +
      `1) id "social", title "3. SOCIAL PRESENCE", entries labeled: "3.x.1 Profile Stats" (per-platform labeled blocks with real numbers from the research, or explicit "no verified presence found"), "3.x.2 Cadence & Consistency", "3.x.3 Format Mix", "3.x.4 Engagement Rate" (normalize to followers when numbers exist), "3.x.5 Growth Velocity".\n` +
      `2) id "content", title "4. CONTENT STRATEGY", entries labeled: "4.1 Content Pillars / Themes", "4.2 Recurring Series / Franchises", "4.3 Hook Patterns" (labeled blocks with example hooks), "4.4 CTA / Funnel Intent", "4.5 Brand Voice / Tone", "4.6 Production Style".\n` +
      `3) id "top-performers", title "5. TOP PERFORMERS", entries labeled: "5.x.1 The Content" (labeled block per best real post found — caption/format/audience; if none verified, clearly-flagged hypothetical posts that would win), "5.x.2 The Numbers" (real metrics or explicit absence), "5.x.3 Why It Won" (the repeatable formula + what Altitut should copy).`,
    maxOutputTokens: 8000,
    validate: (value) => parseSections(value, ["social", "content", "top-performers"]),
  });
  return { ...state, sections: [...(state.sections ?? []), ...(parsed as PackSection[])] };
}

export async function stepSynthesizeVerdict(state: ScoutState): Promise<ScoutState> {
  const parsed = await completeJson<{
    sections: unknown;
    tldr: string;
    tag: string;
    meta: string;
  }>({
    system: SYNTHESIS_SYSTEM,
    user:
      `${synthesisContext(state)}\n\n` +
      `ALREADY-WRITTEN SECTIONS 1-5 (for consistency):\n${JSON.stringify(state.sections ?? []).slice(0, 6000)}\n\n` +
      `Produce JSON {"sections": [...], "tldr": "...", "tag": "...", "meta": "..."} where sections are EXACTLY:\n` +
      `1) id "paid", title "6. PAID & PARTNERSHIPS", entries labeled: "6.1 Active Ads" (Meta Ad Library / Google Ads evidence or explicit absence), "6.2 Partnerships".\n` +
      `2) id "audience", title "7. AUDIENCE & COMMUNITY", entries labeled: "7.1 Sentiment" (labeled blocks "Expected praise"/"Potential complaints" grounded in reviews found), "7.2 Whitespace" (gaps Altitut can own), "7.3 Responsiveness", "7.4 Owned Community".\n` +
      `3) id "synthesis", title "8. SYNTHESIS", entries labeled: "8.1 Winning Formula" (their strategy in one line + bullets), "8.2 Recent Strategic Shifts", "8.3 Steal / Avoid / Test" (three labeled blocks: "Steal", "Avoid", "Test"), "8.4 Hooks into Content Packs" (how this feeds Altitut's content series).\n\n` +
      `"tldr": a 4-5 line executive summary as TWO paragraphs separated by \\n\\n — paragraph 1: who they are + tier + product shape; paragraph 2: social/content reality + the single clearest play for Altitut.\n` +
      `"tag": a 1-3 word similarity label (e.g. "High Similarity", "Closest Match", "Category Match", "Adjacent Player").\n` +
      `"meta": a tier label like "Tier 1 competitor" or "Tier 2 competitor" based on overlap with Altitut.`,
    maxOutputTokens: 8000,
    validate: (value) => {
      const record = value as Record<string, unknown>;
      const sections = parseSections(record, ["paid", "audience", "synthesis"]);
      const tldr = typeof record.tldr === "string" ? record.tldr.trim() : "";
      if (!tldr) throw new Error("missing tldr");
      return {
        sections,
        tldr,
        tag: typeof record.tag === "string" && record.tag.trim() ? record.tag.trim() : "New Entrant",
        meta:
          typeof record.meta === "string" && record.meta.trim()
            ? record.meta.trim()
            : "Tier 2 competitor",
      };
    },
  });
  const verdict = parsed as {
    sections: PackSection[];
    tldr: string;
    tag: string;
    meta: string;
  };
  return {
    ...state,
    sections: [...(state.sections ?? []), ...verdict.sections],
    tldr: verdict.tldr,
    tag: verdict.tag,
    meta: verdict.meta,
  };
}

/* ------------------------------------------------------------------ */
/* Step 8 — Assemble the final pack                                    */
/* ------------------------------------------------------------------ */

const SECTION_ORDER = [
  "identity",
  "product",
  "social",
  "content",
  "top-performers",
  "paid",
  "audience",
  "synthesis",
];

export function assemblePack(state: ScoutState): AnalysisPack {
  const candidate = state.candidate;
  if (!candidate || !state.sections || !state.tldr) {
    throw new Error("Scout state is incomplete — synthesis has not finished.");
  }
  const ordered = [...state.sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id),
  );
  if (ordered.length !== SECTION_ORDER.length) {
    throw new Error(
      `Pack has ${ordered.length} sections; expected all ${SECTION_ORDER.length}.`,
    );
  }
  return {
    name: candidate.name,
    tag: state.tag ?? "New Entrant",
    meta: state.meta ?? "Tier 2 competitor",
    links: normalizeLinks(candidate.links),
    tldr: state.tldr,
    sections: ordered,
  };
}
