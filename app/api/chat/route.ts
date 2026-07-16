import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { ALTITUT_CHAT_CONTEXT } from "../../../lib/altitut";
import { CHAT_MODEL } from "../../../lib/openai";
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

  // Hybrid retrieval over the Firestore-backed vector store (competitor
  // packs + content packs + Altitut product knowledge).
  let contextBlock = "";
  let retrievalNote = "";
  try {
    const chunks = await hybridRetrieve(question, 12);
    contextBlock = chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] (${chunk.docType} · ${chunk.sourceName} · ${chunk.sectionTitle} · ${chunk.entryLabel})\n${chunk.text}`,
      )
      .join("\n\n");
  } catch (error) {
    retrievalNote =
      "NOTE: the knowledge base could not be reached for this turn — answer from the Altitut context and the conversation only, and say that retrieval failed. " +
      `(${error instanceof Error ? error.message : String(error)})`;
  }

  const system = `You are the Competitor Analysis copilot inside Altitut's Social Media Command Center. You answer questions about tracked competitors, compare them, and turn competitive insights into actionable moves for Altitut's product and social media strategy.

=== ABOUT ALTITUT (OUR PRODUCT) ===
${ALTITUT_CHAT_CONTEXT}

=== RETRIEVED INTELLIGENCE (from the competitor & content-pack knowledge base) ===
${contextBlock || "(no chunks retrieved)"}
${retrievalNote}

RESPONSE RULES:
- Default to a TL;DR-style answer: 2-6 tight sentences or a short bullet list. You are a chatbot, not a report generator.
- Only go long/comprehensive when the user explicitly asks for depth ("comprehensive", "detailed", "full breakdown", "everything about…").
- Ground every claim in the retrieved intelligence above; when citing, mention the competitor and section naturally (e.g. "Startup Wars' social presence data shows…"). If the knowledge base doesn't cover something, say so plainly instead of guessing.
- When useful, end with one sharp "for Altitut" implication.
- Use markdown: short paragraphs, **bold** for key terms, bullet lists, tables only when comparing 3+ items.`;

  const result = streamText({
    model: openai(CHAT_MODEL),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
