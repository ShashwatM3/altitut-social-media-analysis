/**
 * Registers the Telegram bot's webhook with this deployment.
 *
 * Usage:
 *   npm run telegram:webhook -- https://your-app.vercel.app
 *
 * Requires TELEGRAM_BOT_TOKEN (and optionally TELEGRAM_WEBHOOK_SECRET) in .env.
 */
import "dotenv/config";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set in .env — create a bot with @BotFather first (see SETUP_NEEDED_FROM_YOU.md).",
    );
  }
  const baseUrl = process.argv[2];
  if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
    throw new Error(
      "Pass your public HTTPS deployment URL, e.g.: npm run telegram:webhook -- https://your-app.vercel.app",
    );
  }
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: true,
      ...(secret ? { secret_token: secret } : {}),
    }),
  });
  const payload = await response.json();
  console.log("setWebhook →", JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exit(1);
  }

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log("getWebhookInfo →", JSON.stringify(await info.json(), null, 2));
  console.log(`\nWebhook registered: ${webhookUrl}`);
  console.log("Message your bot an Instagram reel link to test it.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
