import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { CHAT_MODEL } from "../../../lib/openai";
import { ensurePlatformGuideIngested } from "../../../lib/platform-guide";
import { hybridRetrieve } from "../../../lib/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

function lastUserText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const question = lastUserText(messages);

  let contextBlock = "";
  let retrievalNote = "";
  try {
    // First help-chat after deploy may not have platform-guide chunks yet
    // (seed hasn't been re-run) — ingest from docs/PLATFORM-GUIDE.md once.
    await ensurePlatformGuideIngested();
    const chunks = await hybridRetrieve(question, 10, {
      docTypes: ["platform-guide"],
    });
    contextBlock = chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] (${chunk.sectionTitle} · ${chunk.entryLabel})\n${chunk.text}`,
      )
      .join("\n\n");
  } catch (error) {
    retrievalNote =
      "NOTE: the platform-guide knowledge base could not be reached for this turn — answer only from the conversation and say that retrieval failed. " +
      `(${error instanceof Error ? error.message : String(error)})`;
  }

  const system = `You are the Help assistant for Altitut's Social Media Command Center dashboard. You teach teammates how to USE this platform — navigation, Competitor Scout, competitor packs, the competitor copilot, content packs, the Telegram reel bot, Help, seeding, and environment basics.

You are NOT the competitor-intelligence copilot. If the user asks for competitive strategy, competitor comparisons, or "what should we post based on Startup Wars", briefly say they should use the competitor copilot on the Competitors Analysis tab, and answer only the usage part if any.

=== RETRIEVED PLATFORM GUIDE (RAG) ===
${contextBlock || "(no chunks retrieved)"}
${retrievalNote}

RESPONSE RULES:
- Answer how-to questions in plain language with short steps or bullets.
- Ground every claim in the retrieved platform guide. If the guide does not cover something, say so instead of inventing UI that does not exist.
- Default to a concise answer (2-6 sentences or a short checklist). Go longer only when asked.
- Use markdown: **bold** for UI labels (e.g. **Run Competitor Scout**, **Help ?**), numbered steps for procedures.
- Never invent API keys, bot tokens, or claim features that are not in the guide.`;

  const result = streamText({
    model: openai(CHAT_MODEL),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
