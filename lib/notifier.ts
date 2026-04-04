/**
 * Notification helper — send alerts via Telegram or webhook.
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID → Telegram notifications
 *   NOTIFY_WEBHOOK_URL → generic webhook (Slack, Discord, n8n, etc.)
 */

export interface NotifyOptions {
  title: string;
  body: string;
  url?: string;
  priority?: "low" | "normal" | "high";
}

async function sendTelegram(opts: NotifyOptions): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const text = [
    opts.priority === "high" ? "🔴" : opts.priority === "low" ? "🔵" : "🟢",
    `*${opts.title}*`,
    "",
    opts.body,
    opts.url ? `\n🔗 ${opts.url}` : "",
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWebhook(opts: NotifyOptions): Promise<boolean> {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${opts.title}\n${opts.body}`,
        title: opts.title,
        body: opts.body,
        url: opts.url,
        priority: opts.priority,
        source: "hidrix-tools",
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send notification via all configured channels.
 * Returns true if at least one channel succeeded.
 */
export async function notify(opts: NotifyOptions): Promise<boolean> {
  const results = await Promise.allSettled([
    sendTelegram(opts),
    sendWebhook(opts),
  ]);

  return results.some((r) => r.status === "fulfilled" && r.value === true);
}

/**
 * Check if any notification channel is configured.
 */
export function hasNotifier(): boolean {
  return !!(
    (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ||
    process.env.NOTIFY_WEBHOOK_URL
  );
}
