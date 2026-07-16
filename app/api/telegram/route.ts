import { doc, getDoc, setDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { COLLECTIONS, db } from "../../../lib/firebase";
import { fetchPacks, savePack } from "../../../lib/packs";
import { ingestPack } from "../../../lib/rag";
import { buildContentPackFromReel, extractInstagramUrl } from "../../../lib/reel";
import { sendTelegramMessage, telegramConfigured } from "../../../lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 300;

const WELCOME = [
  "👋 This is Altitut's Content Pack bot.",
  "",
  "Send me an Instagram reel link (https://www.instagram.com/reel/…) and I will:",
  "1. Scrape the reel (caption, stats, video) via Apify",
  "2. Transcribe what's said in it",
  "3. Reverse-engineer it into a full content pack (Overview · Strategy · Series · Recipe · Execution)",
  "4. Save it to the Social Media Command Center dashboard",
  "",
  "Just paste a link to get started.",
].join("\n");

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
};

/** Telegram retries webhooks — remember processed update ids in Firestore. */
async function alreadyProcessed(updateId: number): Promise<boolean> {
  const reference = doc(db, COLLECTIONS.telegramUpdates, String(updateId));
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    return true;
  }
  await setDoc(reference, { processedAt: new Date().toISOString() });
  return false;
}

async function processReel(chatId: number, reelUrl: string): Promise<void> {
  try {
    const existing = await fetchPacks(COLLECTIONS.contentPacks);
    const packNumber = existing.length + 1;
    const { pack, reel } = await buildContentPackFromReel(
      reelUrl,
      packNumber,
      (message) => sendTelegramMessage(chatId, message),
    );
    const stored = await savePack(COLLECTIONS.contentPacks, pack, "telegram-bot");
    await ingestPack(pack, "content-pack");

    const overviewEntry = pack.sections[0]?.entries?.[0];
    const premise =
      overviewEntry?.blocks?.find((block) => block.type === "paragraph") ?? null;
    await sendTelegramMessage(
      chatId,
      [
        `✅ *${pack.name}* (${pack.tag}) saved to the dashboard.`,
        "",
        premise && premise.type === "paragraph" ? premise.text : "",
        "",
        `📊 Reference reel: @${reel.ownerUsername} — ${reel.videoViews ?? "?"} views · ${reel.likes ?? "?"} likes · ${reel.comments ?? "?"} comments`,
        `🗂 Sections: Overview · Strategy · Series (3 episodes) · Recipe · Execution`,
        `🆔 ${stored.id}`,
        "",
        "Open the Content Creation tab in the Command Center to see the full pack.",
      ]
        .filter(Boolean)
        .join("\n"),
      { markdown: true },
    );
  } catch (error) {
    console.error("[telegram] reel processing failed:", error);
    await sendTelegramMessage(
      chatId,
      `❌ Couldn't build a pack from that link: ${error instanceof Error ? error.message : "unexpected error"}\n\nTry another reel, or resend this one in a minute.`,
    ).catch(() => {});
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "altitut-telegram-content-pack-bot",
    configured: telegramConfigured(),
  });
}

export async function POST(request: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not configured." },
      { status: 503 },
    );
  }

  // Validate Telegram's secret header when a webhook secret is configured.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const received = request.headers.get("x-telegram-bot-api-secret-token");
    if (received !== expectedSecret) {
      return NextResponse.json({ error: "Bad secret token." }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = update.message;
  const text = message?.text?.trim() ?? "";
  if (!message || !text) {
    return NextResponse.json({ ok: true });
  }
  if (
    typeof update.update_id === "number" &&
    (await alreadyProcessed(update.update_id).catch(() => false))
  ) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const chatId = message.chat.id;

  if (text.startsWith("/start") || text.startsWith("/help")) {
    after(sendTelegramMessage(chatId, WELCOME));
    return NextResponse.json({ ok: true });
  }

  const reelUrl = extractInstagramUrl(text);
  if (!reelUrl) {
    after(
      sendTelegramMessage(
        chatId,
        "Send me an Instagram reel or post link (https://www.instagram.com/reel/…) and I'll turn it into a content pack.",
      ),
    );
    return NextResponse.json({ ok: true });
  }

  // Acknowledge fast (so Telegram doesn't retry), then do the heavy work
  // after the response is sent — within this function's maxDuration budget.
  after(async () => {
    await sendTelegramMessage(
      chatId,
      "🎬 Got it — scraping that reel now. This takes 2–4 minutes; I'll message you at each step.",
    );
    await processReel(chatId, reelUrl);
  });

  return NextResponse.json({ ok: true });
}
