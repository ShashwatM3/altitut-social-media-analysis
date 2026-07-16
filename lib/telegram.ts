function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }
  return token;
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: { markdown?: boolean } = {},
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken()}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        ...(options.markdown ? { parse_mode: "Markdown" } : {}),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[telegram] sendMessage failed (${response.status}): ${detail}`);
    // If Markdown parsing failed, retry as plain text so the user still hears back.
    if (options.markdown) {
      await sendTelegramMessage(chatId, text);
    }
  }
}
