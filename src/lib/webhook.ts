import { db } from "@/db";
import { configSystem } from "@/db/schema";
import { eq } from "drizzle-orm";

// ── Webhook URL cache ─────────────────────────────────────────────────────────
// Avoids a DB round-trip on every audit event.
// Cache TTL: 5 minutes. Reset when admin updates the config.
let _cachedWebhookUrl: string | null | undefined = undefined; // undefined = not yet loaded
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Force-invalidate the webhook URL cache (call after admin updates config). */
export function invalidateWebhookCache(): void {
  _cachedWebhookUrl = undefined;
  _cacheExpiresAt = 0;
}

async function getWebhookUrl(): Promise<string | null> {
  const now = Date.now();

  // Return cached value if still fresh
  if (_cachedWebhookUrl !== undefined && now < _cacheExpiresAt) {
    return _cachedWebhookUrl;
  }

  // Re-fetch from DB
  try {
    const config = await db
      .select({ discordWebhook: configSystem.discordWebhook })
      .from(configSystem)
      .where(eq(configSystem.id, 1))
      .limit(1);

    _cachedWebhookUrl = config[0]?.discordWebhook ?? null;
    _cacheExpiresAt = now + CACHE_TTL_MS;
  } catch {
    // If DB is unreachable, don't poison the cache — just skip this call
    return null;
  }

  return _cachedWebhookUrl;
}

export async function sendDiscordWebhook(
  title: string,
  description: string,
  color: number = 0xff0000,
  fields?: Array<{ name: string; value: string; inline?: boolean }>
) {
  try {
    const webhookUrl = await getWebhookUrl();
    if (!webhookUrl) return;

    const payload = {
      embeds: [
        {
          title,
          description,
          color,
          fields,
          timestamp: new Date().toISOString(),
          footer: {
            text: "Vaultr System Alerts",
          },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[Webhook] Failed to send to Discord:", await res.text());
    }
  } catch (err) {
    console.error("[Webhook] Error dispatching webhook:", err);
  }
}
