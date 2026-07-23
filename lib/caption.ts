import { ALTITUT_CHAT_CONTEXT } from "./altitut";
import { completeJson } from "./openai";

export type Platform = "linkedin" | "facebook" | "instagram";
export type Tone = "professional" | "punchy" | "playful" | "educational";
export type CaptionMode = "generate" | "refine" | "shorten";

export type PlatformCaption = {
  caption: string;
  firstComment: string;
  hashtags: string[];
};

export type CaptionResponse = {
  captions: Record<Platform, PlatformCaption>;
};

type Request = {
  platforms: Platform[];
  mediaKind: "video" | "image";
  brief: string;
  tone?: Tone;
  mode?: CaptionMode;
  existingCopy?: Partial<Record<Platform, string>>;
};

const PLATFORM_RULES = `
Per-platform voice rules:
- LinkedIn — professional, first-person, insight-led. Hook in line one. Line breaks between short paragraphs. Max 3,000 characters. At most 3 hashtags, at the end. No emoji spam.
- Facebook — warm and conversational, community-oriented. Shorter than LinkedIn. Light emoji.
- Instagram — punchy, hook in the first 125 characters (the pre-"more" cut). Max 2,200 characters. Hashtags go in firstComment, never in the caption.

Hard rule: return ONLY the JSON object matching the schema. No markdown, no explanation, no code fences.`;

const JSON_SCHEMA = `
{
  "captions": {
    "linkedin": { "caption": "string", "firstComment": "string", "hashtags": ["string"] },
    "facebook": { "caption": "string", "firstComment": "string", "hashtags": ["string"] },
    "instagram": { "caption": "string", "firstComment": "string", "hashtags": ["string"] }
  }
}
For platforms that are not requested, still include the key with empty strings and an empty hashtags array.`;

function buildPrompt(req: Request): string {
  const modeInstruction =
    req.mode === "refine"
      ? "Refine the existing copy to make it sharper and better aligned with the brief."
      : req.mode === "shorten"
        ? "Shorten the existing copy while keeping the hook and value."
        : "Write fresh captions for the requested platforms based on the brief.";

  const existing = req.existingCopy
    ? `Existing copy to work from:\n${Object.entries(req.existingCopy)
        .filter(([, text]) => text?.trim())
        .map(([p, text]) => `- ${p}: ${text}`)
        .join("\n")}`
    : "";

  return [
    `Media kind: ${req.mediaKind}`,
    `Brief: ${req.brief}`,
    req.tone ? `Tone: ${req.tone}` : "",
    modeInstruction,
    existing,
    `Requested platforms: ${req.platforms.join(", ")}`,
    `Respond with this exact JSON shape:\n${JSON_SCHEMA}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function cleanHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function validateResponse(
  parsed: unknown,
  requested: Platform[],
): CaptionResponse {
  const wrapper = (parsed as { captions?: Record<string, unknown> } | null)
    ?.captions;
  if (!wrapper || typeof wrapper !== "object") {
    return { captions: buildEmpty() };
  }

  const captions = buildEmpty();
  for (const platform of requested) {
    const raw = wrapper[platform] as
      | Record<string, unknown>
      | undefined;
    const caption =
      typeof raw?.caption === "string" ? raw.caption.trim() : "";
    const firstComment =
      typeof raw?.firstComment === "string" ? raw.firstComment.trim() : "";
    const hashtags = cleanHashtags(raw?.hashtags);

    if (platform === "instagram") {
      // Hashtags must never live in the Instagram caption.
      const hashtagPattern = /#\w+/g;
      const extracted = caption.match(hashtagPattern) ?? [];
      const cleanCaption = caption.replace(hashtagPattern, "").trim();
      const allHashtags = Array.from(
        new Set([...hashtags, ...extracted]),
      ).join(" ");
      captions.instagram = {
        caption: cleanCaption,
        firstComment: firstComment || allHashtags,
        hashtags: cleanHashtags(allHashtags.split(" ")),
      };
      if (captions.instagram.caption.length > 2200) {
        captions.instagram.caption = captions.instagram.caption.slice(0, 2200);
      }
    } else if (platform === "linkedin") {
      const allHashtags = hashtags.slice(0, 3);
      const joined = allHashtags.join(" ");
      let finalCaption = caption;
      if (!finalCaption.toLowerCase().includes(joined.toLowerCase())) {
        finalCaption = finalCaption.trimEnd();
        if (allHashtags.length > 0) {
          finalCaption = `${finalCaption}\n\n${joined}`.trim();
        }
      }
      if (finalCaption.length > 3000) {
        finalCaption = finalCaption.slice(0, 3000);
      }
      captions.linkedin = {
        caption: finalCaption,
        firstComment,
        hashtags: allHashtags,
      };
    } else {
      if (caption.length > 63206) {
        // Facebook has a very high limit; guard against absurd lengths.
        captions.facebook = { caption: caption.slice(0, 63206), firstComment, hashtags };
      } else {
        captions.facebook = { caption, firstComment, hashtags };
      }
    }
  }
  return { captions };
}

function buildEmpty(): Record<Platform, PlatformCaption> {
  return {
    linkedin: { caption: "", firstComment: "", hashtags: [] },
    facebook: { caption: "", firstComment: "", hashtags: [] },
    instagram: { caption: "", firstComment: "", hashtags: [] },
  };
}

export async function generateCaptions(req: Request): Promise<CaptionResponse> {
  const requested: Platform[] =
    req.platforms.length > 0 ? req.platforms : ["linkedin"];
  const result = await completeJson<CaptionResponse>({
    system: `${ALTITUT_CHAT_CONTEXT}\n\n${PLATFORM_RULES}`,
    user: buildPrompt({ ...req, platforms: requested }),
    validate: (parsed) => validateResponse(parsed, requested),
  });
  return result;
}
