export const runtime = "nodejs";

/**
 * /api/vault/stream
 *
 * Server-Sent Events endpoint for real-time vault updates.
 * Clients connect once on mount and receive push notifications when their
 * vault data changes. On receiving a 'vault_changed' event, the client
 * re-fetches from /api/vault/items.
 *
 * This implementation uses a simple polling approach under the hood
 * (checks for changes every 3s) and pushes SSE diffs to the client.
 * This keeps zero extra infrastructure (no WebSocket server needed).
 */

import { NextRequest } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems } from "@/db/schema";
import { eq, max } from "drizzle-orm";

export async function GET(req: NextRequest) {
  let user: { id: string };
  try {
    user = await verifyUserToken(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let lastUpdatedAt = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      }

      // Send initial ping to confirm connection
      send({ type: "connected" });

      // Poll for changes every 3 seconds
      const interval = setInterval(async () => {
        try {
          const [result] = await db
            .select({ latestUpdate: max(vaultItems.updatedAt) })
            .from(vaultItems)
            .where(eq(vaultItems.userId, user.id));

          const latestUpdate = result?.latestUpdate;
          if (latestUpdate && new Date(latestUpdate) > lastUpdatedAt) {
            lastUpdatedAt = new Date(latestUpdate);
            send({ type: "vault_changed" });
          }
        } catch { /* db error — silently skip this tick */ }
      }, 3000);

      // Keep-alive ping every 25 seconds (prevents proxy timeouts)
      const keepAlive = setInterval(() => {
        send({ type: "ping" });
      }, 25_000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering for SSE
    },
  });
}
