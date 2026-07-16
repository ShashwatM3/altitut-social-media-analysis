import { toFile } from "openai";
import type { AnalysisPack, PackSection } from "../app/components/pack-panel";
import { DEFAULT_ALTITUT_DESCRIPTION } from "./altitut";
import { scrapeInstagramPost } from "./apify";
import { completeJson, getOpenAI } from "./openai";
import { normalizeSection } from "./packs";

export type ReelMusicInfo = {
  artist: string;
  song: string;
  usesOriginalAudio: boolean | null;
};

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
  /** Cover frame + any carousel/still images returned by the scraper. */
  displayUrl: string | null;
  images: string[];
  musicInfo: ReelMusicInfo | null;
  productType: string;
};

/** Everything the analysis pass observed about the reel, used to ground
 *  every later synthesis pass so nothing about style/audio is invented. */
export type ReelAnalysis = {
  section: PackSection;
  observedFacts: string;
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
  const rawMusic = item.musicInfo;
  let musicInfo: ReelMusicInfo | null = null;
  if (rawMusic && typeof rawMusic === "object") {
    const music = rawMusic as Record<string, unknown>;
    musicInfo = {
      artist: typeof music.artist_name === "string" ? music.artist_name : "",
      song: typeof music.song_name === "string" ? music.song_name : "",
      usesOriginalAudio:
        typeof music.uses_original_audio === "boolean"
          ? music.uses_original_audio
          : null,
    };
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
    displayUrl: typeof item.displayUrl === "string" ? item.displayUrl : null,
    images: Array.isArray(item.images)
      ? item.images.filter((url): url is string => typeof url === "string")
      : [],
    musicInfo,
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
/* Shared prompt plumbing                                               */
/* ------------------------------------------------------------------ */

const CONTENT_PACK_RULES = `Each section is {"id", "title", "entries": [{"label", "blocks"}]} — the episode-plan section uses "episodes": [{"title", "entries"}] instead of entries.
Each block is ONE of:
  {"type": "paragraph", "text": "..."}
  {"type": "bullets", "items": ["...", "..."]} — 3-7 substantive items
  {"type": "labeled", "label": "Group name", "items": ["...", "..."]}
Entry pattern: an opening paragraph block, then one or two bullets/labeled blocks.
Every bullet must be specific and executable by a social media team member — camera directions, spoken lines, timings — never generic advice.`;

function reelDigest(reel: ReelData, transcript: string | null): string {
  const audioLine = reel.musicInfo
    ? `Audio metadata: ${reel.musicInfo.usesOriginalAudio ? "ORIGINAL audio (creator's own voice/sound)" : "licensed track"}${reel.musicInfo.song ? ` — "${reel.musicInfo.song}" by ${reel.musicInfo.artist}` : ""}`
    : "Audio metadata: not returned by scraper";
  return [
    `Reel URL: ${reel.url}`,
    `Creator: @${reel.ownerUsername}${reel.ownerFullName ? ` (${reel.ownerFullName})` : ""}`,
    `Stats: likes=${reel.likes ?? "?"} comments=${reel.comments ?? "?"} views=${reel.videoViews ?? "?"} duration=${reel.videoDurationSeconds ?? "?"}s posted=${reel.timestamp ?? "?"}`,
    audioLine,
    `Caption (VERBATIM — this is exactly what the creator posted):\n${reel.caption || "(no caption)"}`,
    `Hashtags: ${reel.hashtags.join(" ") || "(none — the creator used no hashtags)"}`,
    `Full spoken transcript (Whisper, VERBATIM):\n${transcript ?? "(transcript unavailable — rely on caption, images, and stats only, and say so where it matters)"}`,
  ].join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Step 3 — UNDERSTANDING THE REEL (vision-grounded analysis pass)      */
/* ------------------------------------------------------------------ */

/** Instagram CDN URLs are signed and blocked for third-party fetchers like
 *  OpenAI's — download frames ourselves and inline them as data URLs. */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 6 * 1024 * 1024) return null;
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function analyzeReel(
  reel: ReelData,
  transcript: string | null,
): Promise<ReelAnalysis> {
  const candidateUrls = [reel.displayUrl, ...reel.images]
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);
  const frameUrls = (
    await Promise.all(candidateUrls.map(fetchImageAsDataUrl))
  ).filter((dataUrl): dataUrl is string => dataUrl !== null);

  const parsed = await completeJson<{
    section: PackSection;
    observed_facts: string;
  }>({
    system:
      "You are a short-form video analyst. You dissect ONE Instagram reel with forensic accuracy. " +
      "You may ONLY state what is directly evidenced by the transcript, caption, stats, audio metadata, and the attached frame images. " +
      "Quote the creator's actual words when describing hooks and beats. If something cannot be observed (e.g. background music when metadata is missing), write 'not observable from available data' — NEVER guess or embellish. " +
      CONTENT_PACK_RULES,
    user:
      `=== THE REEL (scraped live; frames attached as images) ===\n${reelDigest(reel, transcript)}\n\n` +
      `Produce JSON {"section", "observed_facts"}.\n\n` +
      `"section": {"id": "understanding", "title": "1. UNDERSTANDING THE REEL", "entries": [...]} with EXACTLY these entries:\n` +
      `- "1.1 What Actually Happens" — a beat-by-beat replay of the reel from the transcript (opening line quoted verbatim → middle beats → ending), with approximate second-marks scaled to the real ${reel.videoDurationSeconds ?? "?"}s duration.\n` +
      `- "1.2 The Hook" — the verbatim opening line(s) in quotes + a breakdown of the psychological devices it uses (pattern interrupt, negative qualifier, curiosity gap, etc. — only ones actually present).\n` +
      `- "1.3 Structure & Strategy" — the narrative arc, retention devices, pacing, how it earns the next second of watch time, and what the creator is strategically doing (positioning, vulnerability, authority…).\n` +
      `- "1.4 Production Style (as observed)" — labeled blocks "On screen" (what the frames + transcript evidence: talking head? photos? text overlays/captions?), "Audio" (from audio metadata + transcript: original voice? track?), "Caption & hashtags" (describe the VERBATIM caption strategy — if it's minimal, say so and explain why that works or doesn't).\n` +
      `- "1.5 Why It Performed" — tie the real numbers (${reel.videoViews ?? "?"} views, ${reel.likes ?? "?"} likes, ${reel.comments ?? "?"} comments) to the specific craft choices above.\n\n` +
      `"observed_facts": a dense 10-15 line plain-text fact sheet of ONLY observed production facts, one per line, for downstream writers. Cover: format (talking head / voiceover / b-roll), visual elements seen in frames, text overlay style, audio reality, caption reality, hashtag reality, hook quote, duration, pacing, tone. Prefix unobservable items with "UNKNOWN:".`,
    images: frameUrls,
    maxOutputTokens: 6000,
    validate: (value) => {
      const record = value as Record<string, unknown>;
      const section = normalizeSection(record.section);
      if (!section || !section.entries || section.entries.length < 4) {
        throw new Error("understanding section must have the 5 requested entries");
      }
      const observedFacts =
        typeof record.observed_facts === "string" ? record.observed_facts.trim() : "";
      if (!observedFacts) throw new Error("missing observed_facts");
      return { section, observed_facts: observedFacts };
    },
  });

  const result = parsed as { section: PackSection; observed_facts: string };
  return { section: result.section, observedFacts: result.observed_facts };
}

/* ------------------------------------------------------------------ */
/* Step 4 — HOW IT TRANSFERS TO ALTITUT (grounded synthesis)            */
/* ------------------------------------------------------------------ */

const GROUNDING_RULES = `GROUNDING RULES (non-negotiable):
- The "OBSERVED FACTS" block below is the ONLY source of truth about the reference reel's format, visuals, audio, caption, and hashtags. Sections 5.2 Visual Style and 5.3 Audio must MIRROR the reel's observed style (adapted to Altitut's subject matter) — if the reel is a raw talking head with photo cut-ins and caption overlays, the recipe is a raw talking head with photo cut-ins and caption overlays, NOT animations, stock footage, or background music that was never there.
- Never introduce music, graphics, effects, or caption/hashtag tactics that contradict the observed facts. If you deliberately deviate from the reel (e.g. adding hashtags the creator didn't use), flag it explicitly as "Deviation from the reference reel:" with a one-line justification.
- Altitut's pixel-art game aesthetic may ONLY appear as actual product footage being shown (screen recordings of the product), never as the reel's overall art style.
- Where a fact is marked UNKNOWN, write "match the reference reel" rather than inventing a choice.`;

export async function synthesizeContentPack(
  reel: ReelData,
  transcript: string | null,
  analysis: ReelAnalysis,
  packNumber: number,
): Promise<AnalysisPack> {
  const sharedContext =
    `=== ALTITUT (THE PRODUCT THIS SERIES MUST PROMOTE) ===\n${DEFAULT_ALTITUT_DESCRIPTION}\n\n` +
    `=== THE REFERENCE REEL (scraped live) ===\n${reelDigest(reel, transcript)}\n\n` +
    `=== OBSERVED FACTS (from the frame-level analysis pass) ===\n${analysis.observedFacts}`;
  const system =
    "You are Altitut's head of social content. You translate ONE analyzed viral reel into a repeatable content-series pack that Altitut's social team can execute. The pack answers: how does this reel's craft transfer to Altitut? " +
    GROUNDING_RULES +
    "\n" +
    CONTENT_PACK_RULES;

  // Two focused generations are far more structure-reliable than one giant one:
  // (A) plan sections 2, 3, 5, 6 — (B) the three concrete episodes for section 4.
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
      `"meta": format line like "45–90s Reel · IG / TikTok / Shorts" — pick a clean rounded range containing the reel's real ~${reel.videoDurationSeconds ? Math.round(reel.videoDurationSeconds) : "?"}s duration (e.g. "20–30s Reel · IG / TikTok / Shorts").\n` +
      `"sections" are EXACTLY these four (numbering continues after "1. UNDERSTANDING THE REEL", which is already written):\n` +
      `1) id "overview", title "2. OVERVIEW" — entries "2.1 Series Name + Premise" (include a labeled block "One-line hook concept" and "What makes this a franchise (not a one-off)"), "2.2 Format & Platform" (labeled blocks: Format / Length / Platforms / Visual mode — all mirroring the OBSERVED FACTS), "2.3 Origin" (what the reference reel proves works — cite its real craft choices and numbers — and why the format fits Altitut).\n` +
      `2) id "strategy", title "3. STRATEGY" — entries "3.1 What It Promotes" (which Altitut features this series demos), "3.2 Goal" (labeled: Primary goal / Secondary goal), "3.3 Who It's For".\n` +
      `3) id "recipe", title "5. THE RECIPE → HOW TO MAKE" — entries "5.1 Structure" (hook→body→CTA skeleton with second-marks mirroring the reference reel's actual pacing from the observed facts), "5.2 Visual Style" (MIRROR the observed on-screen reality), "5.3 Audio" (MIRROR the observed audio reality), "5.4 Caption + Hashtags" (start from the reel's VERBATIM caption strategy; any deviation must be flagged as such).\n` +
      `4) id "execution", title "6. EXECUTION" — entries "6.1 Cadence", "6.2 Roles & Effort", "6.3 What Good Looks Like" (light leading metrics benchmarked against the reel's real numbers).`,
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
      `Produce JSON for the episode plan section ONLY: {"id": "series", "title": "4. THE SERIES → WHAT TO MAKE", "episodes": [...]} with EXACTLY 3 episodes.\n` +
      `Each episode: {"title": "Episode N — <specific angle>", "entries": [...]} with entries labeled "4.N.1 Title / Angle", "4.N.2 Hook" (spoken first line modeled on the reference reel's actual hook device + visual hook direction consistent with the observed format), "4.N.3 What It Shows" (beat-by-beat with rough second-marks matching the reel's observed pacing), "4.N.4 CTA" (a CTA consistent with the reel's low-pressure style; if using a comment-keyword funnel, flag it as a deviation — one DIFFERENT single-word keyword per episode).\n` +
      `Episode 1 must be Altitut's closest adaptation of the reference reel itself (same emotional register, same structure, Altitut's story); episodes 2-3 extend the same franchise to other Altitut angles.`,
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
    analysis.section,
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

/** Full pipeline: reel URL → scrape → transcript → reel analysis → pack. */
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
      ? "Transcript captured. Analyzing the reel frame-by-frame…"
      : "No transcript available (video inaccessible) — analyzing from caption, frames + stats…",
  );
  const analysis = await analyzeReel(reel, transcript);
  await onProgress?.(
    "Reel understood (hook, structure, production style). Building Altitut's content pack…",
  );
  const pack = await synthesizeContentPack(reel, transcript, analysis, packNumber);
  return { pack, reel, transcript };
}
