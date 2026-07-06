import { sendDiscordWebhook } from "@/lib/webhook";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await sendDiscordWebhook(
        "🚀 Server Instance Started",
        `The Vaultr application server has initialized successfully.\n\n**Environment:** ${process.env.NODE_ENV || "development"}\n**Timestamp:** ${new Date().toUTCString()}`,
        0x2ecc71 // Green success color
      );
    } catch (err) {
      console.error("[Instrumentation] Failed to dispatch startup webhook:", err);
    }
  }
}
