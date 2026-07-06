import { db } from "@/db";
import { configSystem } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function sendDiscordWebhook(
  title: string, 
  description: string, 
  color: number = 0xff0000,
  fields?: Array<{ name: string; value: string; inline?: boolean }>
) {
  try {
    // Get the webhook URL from the database config
    const config = await db.select().from(configSystem).where(eq(configSystem.id, 1)).limit(1);
    const webhookUrl = config[0]?.discordWebhook;

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
            text: "Vaultr System Alerts"
          }
        }
      ]
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("[Webhook] Failed to send to Discord:", await res.text());
    }
  } catch (err) {
    console.error("[Webhook] Error dispatching webhook:", err);
  }
}
