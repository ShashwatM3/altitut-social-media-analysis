import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set.");
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Shortened embedding size — keeps the Firestore-backed vector store small. */
export const EMBEDDING_DIMENSIONS = 512;

/**
 * Chat completion that must return a JSON object. Parses the response and
 * retries once with the parse error appended before giving up. Optional
 * `images` (URLs) are attached to the user turn for vision grounding.
 */
export async function completeJson<T>(options: {
  system: string;
  user: string;
  images?: string[];
  maxOutputTokens?: number;
  validate?: (parsed: unknown) => T;
}): Promise<T> {
  const openai = getOpenAI();
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userText =
      attempt === 0
        ? options.user
        : `${options.user}\n\nYour previous answer was invalid JSON or failed validation (${lastError}). Respond again with ONLY the corrected JSON object.`;
    const userContent:
      | string
      | (
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string; detail: "low" } }
        )[] = options.images?.length
      ? [
          { type: "text", text: userText },
          ...options.images.slice(0, 4).map(
            (url) =>
              ({
                type: "image_url",
                image_url: { url, detail: "low" },
              }) as const,
          ),
        ]
      : userText;
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      max_tokens: options.maxOutputTokens ?? 4096,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: userContent },
      ],
    });
    const text = response.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(text);
      return options.validate ? options.validate(parsed) : (parsed as T);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Model did not return valid JSON: ${lastError}`);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const openai = getOpenAI();
  const vectors: number[][] = [];
  // The embeddings endpoint caps batch size; 96 keeps requests comfortably small.
  for (let start = 0; start < texts.length; start += 96) {
    const batch = texts.slice(start, start + 96);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      input: batch,
    });
    for (const item of response.data) {
      vectors.push(item.embedding.map((value) => Number(value.toFixed(6))));
    }
  }
  return vectors;
}
