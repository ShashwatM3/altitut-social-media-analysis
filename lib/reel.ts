import { toFile } from "openai";
import type { AnalysisPack, PackSection } from "../app/components/pack-panel";
import { DEFAULT_ALTITUT_DESCRIPTION } from "./altitut";
import { scrapeInstagramPost } from "./apify";
import { completeJson, getOpenAI } from "./openai";
import { normalizeSection } from "./packs";

export type ReelData = {
  url: string;
  caption: string;
  hashtags: string[];
  ownerUsername: string;
  ownerFullName: string;
  likes: number | null;
  comments: number | null;
  videoViews: number | null;
  videoDurationSeconds: number | null;
  timestamp: string | null;
  videoUrl: string | null;
  productType: string;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function extractInstagramUrl(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?/,
  );
  return match ? match[0] : null;
}

/** Step 1 — live-scrape the reel via Apify (apify/instagram-scraper). */
export async function fetchReelData(reelUrl: string): Promise<ReelData> {
  const item = await scrapeInstagramPost(reelUrl);
  if (!item) {
    throw new Error(
      "Apify returned no data for that link — the reel may be private, deleted, or region-locked.",
    );
  }
  if (typeof item.error === "string" && item.error) {
    throw new Error(`Apify could not scrape the reel: ${item.error}`);
  }
  return {
    url: reelUrl,
    caption: typeof item.caption === "string" ? item.caption : "",
    hashtags: Array.isArray(item.hashtags) ? item.hashtags.map(String) : [],
    ownerUsername:
      typeof item.ownerUsername === "string" ? item.ownerUsername : "",
    ownerFullName:
      typeof item.ownerFullName === "string" ? item.ownerFullName : "",
    likes: asNumber(item.likesCount),
    comments: asNumber(item.commentsCount),
    videoViews: asNumber(item.videoPlayCount) ?? asNumber(item.videoViewCount),
    videoDurationSeconds: asNumber(item.videoDuration),
    timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
    videoUrl: typeof item.videoUrl === "string" ? item.videoUrl : null,
    productType: typeof item.productType === "string" ? item.productType : "",
  };
}

/** Step 2 — download the reel video and transcribe it with Whisper. */
export async function transcribeReel(videoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(videoUrl, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // Whisper caps uploads at 25 MB; skip transcript rather than fail the run.
    if (buffer.byteLength > 24 * 1024 * 1024) {
      return null;
    }
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: await toFile(buffer, "reel.mp4"),
    });
    return transcription.text?.trim() || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Step 3 — synthesize the five-section content pack                   */
/* ------------------------------------------------------------------ */

const CONTENT_PACK_RULES = `Each section is {"id", "title", "entries": [{"label", "blocks"}]} — section 3 uses "episodes": [{"title", "entries"}] instead of entries.
Each block is ONE of:
  {"type": "paragraph", "text": "..."}
  {"type": "bullets", "items": ["...", "..."]} — 3-7 substantive items
  {"type": "labeled", "label": "Group name", "items": ["...", "..."]}
Entry pattern: an opening paragraph block, then one or two bullets/labeled blocks.
Every bullet must be specific and executable by a social media team member — camera directions, spoken lines, timings — never generic advice.`;

function reelDigest(reel: ReelData, transcript: string | null): string {
  return [
    `Reel URL: ${reel.url}`,
    `Creator: @${reel.ownerUsername}${reel.ownerFullName ? ` (${reel.ownerFullName})` : ""}`,
    `Stats: likes=${reel.likes ?? "?"} comments=${reel.comments ?? "?"} views=${reel.videoViews ?? "?"} duration=${reel.videoDurationSeconds ?? "?"}s posted=${reel.timestamp ?? "?"}`,
    `Caption:\n${reel.caption || "(no caption)"}`,
    `Hashtags: ${reel.hashtags.join(" ") || "(none)"}`,
    `Spoken transcript (Whisper):\n${transcript ?? "(transcript unavailable — rely on caption and stats)"}`,
  ].join("\n\n");
}

export async function synthesizeContentPack(
  reel: ReelData,
  transcript: string | null,
  packNumber: number,
): Promise<AnalysisPack> {
  const sharedContext =
    `=== ALTITUT (THE PRODUCT THIS SERIES MUST PROMOTE) ===\n${DEFAULT_ALTITUT_DESCRIPTION}\n\n` +
    `=== THE REFERENCE REEL (scraped live) ===\n${reelDigest(reel, transcript)}`;
  const system =
    "You are Altitut's head of social content. You reverse-engineer a viral Instagram reel into a repeatable content-series pack ('content pack') that Altitut's social team can execute to promote Altitut. " +
    CONTENT_PACK_RULES;

  // Two focused generations are far more structure-reliable than one giant one:
  // (A) plan sections 1, 2, 4, 5 — (B) the three concrete episodes for section 3.
  const plan = await completeJson<{
    name: string;
    meta: string;
    sections: PackSection[];
  }>({
    system,
    user:
      `${sharedContext}\n\n` +
      `Produce JSON {"name", "meta", "sections"} where:\n` +
      `"name": a punchy 2-4 word series name for Altitut's version of this format (NOT the creator's name).\n` +
      `"meta": format line like "45–90s Reel · IG / TikTok / Shorts" (adjust to the reel's real duration).\n` +
      `"sections" are EXACTLY these four, adapted from the reference reel's actual format, pacing, and hook:\n` +
      `1) id "overview", title "1. OVERVIEW" — entries "1.1 Series Name + Premise" (include a labeled block "One-line hook concept" and "What makes this a franchise (not a one-off)"), "1.2 Format & Platform" (labeled blocks: Format / Length / Platforms / Visual mode — grounded in the reel's actual style), "1.3 Origin" (what the reference reel proves works + why the format fits Altitut).\n` +
      `2) id "strategy", title "2. STRATEGY" — entries "2.1 What It Promotes" (which Altitut features this series demos), "2.2 Goal" (labeled: Primary goal / Secondary goal), "2.3 Who It's For".\n` +
      `3) id "recipe", title "4. THE RECIPE → HOW TO MAKE" — entries "4.1 Structure" (hook→body→CTA skeleton with second-marks mirroring the reference reel's pacing), "4.2 Visual Style", "4.3 Audio", "4.4 Caption + Hashtags" (fill-in caption template + concrete hashtag set).\n` +
      `4) id "execution", title "5. EXECUTION" — entries "5.1 Cadence", "5.2 Roles & Effort", "5.3 What Good Looks Like" (light leading metrics referencing the reel's real numbers as the benchmark).`,
    maxOutputTokens: 7000,
    validate: (value) => {
      const record = value as Record<string, unknown>;
      if (!Array.isArray(record.sections)) throw new Error("missing sections");
      const sections = record.sections
        .map(normalizeSection)
        .filter((section): section is PackSection => section !== null);
      const ids = sections.map((section) => section.id);
      for (const required of ["overview", "strategy", "recipe", "execution"]) {
        if (!ids.includes(required)) {
          throw new Error(`missing section id "${required}" (got: ${ids.join(", ")})`);
        }
      }
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) throw new Error("missing pack name");
      return {
        name,
        meta:
          typeof record.meta === "string" && record.meta.trim()
            ? record.meta.trim()
            : "45–90s Reel · IG / TikTok / Shorts",
        sections,
      };
    },
  });

  const series = await completeJson<PackSection>({
    system,
    user:
      `${sharedContext}\n\n` +
      `The series is called "${plan.name}". Its overview/strategy (already written):\n${JSON.stringify(plan.sections.slice(0, 2)).slice(0, 3500)}\n\n` +
      `Produce JSON for the episode plan section ONLY: {"id": "series", "title": "3. THE SERIES → WHAT TO MAKE", "episodes": [...]} with EXACTLY 3 episodes.\n` +
      `Each episode: {"title": "Episode N — <specific angle>", "entries": [...]} with entries labeled "3.N.1 Title / Angle", "3.N.2 Hook" (spoken first line + visual hook direction), "3.N.3 What It Shows" (beat-by-beat with rough second-marks), "3.N.4 CTA" (comment-keyword funnel — a DIFFERENT single-word keyword per episode).\n` +
      `Episode 1 should be Altitut's closest adaptation of the reference reel itself; episodes 2-3 extend the same franchise to other Altitut angles.`,
    maxOutputTokens: 6000,
    validate: (value) => {
      const section = normalizeSection(value);
      if (!section || !section.episodes || section.episodes.length < 3) {
        throw new Error("expected a section with 3 episodes");
      }
      return section;
    },
  });

  const ordered: PackSection[] = [
    plan.sections.find((section) => section.id === "overview")!,
    plan.sections.find((section) => section.id === "strategy")!,
    series,
    plan.sections.find((section) => section.id === "recipe")!,
    plan.sections.find((section) => section.id === "execution")!,
  ];

  return {
    name: plan.name,
    tag: `Pack ${String(packNumber).padStart(2, "0")}`,
    meta: plan.meta,
    referenceReels: [reel.url],
    sections: ordered,
  };
}

/** Full pipeline: reel URL → scraped data → transcript → content pack. */
export async function buildContentPackFromReel(
  reelUrl: string,
  packNumber: number,
  onProgress?: (message: string) => Promise<void>,
): Promise<{ pack: AnalysisPack; reel: ReelData; transcript: string | null }> {
  const reel = await fetchReelData(reelUrl);
  await onProgress?.(
    `Scraped the reel by @${reel.ownerUsername || "unknown"} — ${reel.videoViews ?? "?"} views, ${reel.likes ?? "?"} likes. Transcribing…`,
  );
  const transcript = reel.videoUrl ? await transcribeReel(reel.videoUrl) : null;
  await onProgress?.(
    transcript
      ? "Transcript captured. Building your content pack…"
      : "No transcript available (video inaccessible) — building the pack from caption + stats…",
  );
  const pack = await synthesizeContentPack(reel, transcript, packNumber);
  return { pack, reel, transcript };
}
