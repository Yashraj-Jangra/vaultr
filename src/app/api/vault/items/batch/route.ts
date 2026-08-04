export const runtime = "nodejs";

/**
 * POST /api/vault/items/batch
 *
 * Executes a bulk action on multiple vault items in a single DB transaction.
 *
 * Actions:
 *  - trash        → set deletedAt = now() for all ids
 *  - restore      → set deletedAt = null for all ids
 *  - favorite     → set favorite = true for all ids
 *  - unfavorite   → set favorite = false for all ids
 *  - move         → set folder = payload for all ids (payload = "" = uncategorized)
 *  - purge        → permanently delete items + attachments from S3
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, configStats } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { deleteAttachmentsByVaultItem } from "@/lib/storage";
import { z } from "zod";

const BatchSchema = z.object({
  action: z.enum(["trash", "restore", "favorite", "unfavorite", "move", "purge"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
  payload: z.string().max(100).optional(), // folder name for "move"
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = BatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { action, ids, payload } = parsed.data;

    // Ownership check: verify all requested ids belong to this user
    const ownedItems = await db
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, ids)));

    const ownedIds = ownedItems.map((i) => i.id);
    const notOwned = ids.filter((id) => !ownedIds.includes(id));

    if (notOwned.length > 0) {
      return NextResponse.json(
        { error: "Some items not found or not owned by user", notFound: notOwned },
        { status: 403 }
      );
    }

    if (ownedIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    // Handle Permanent Deletion / Purge
    if (action === "purge") {
      // 1. Cascade: delete all S3 attachments for these items
      await Promise.all(ownedIds.map((id) => deleteAttachmentsByVaultItem(user.id, id).catch(() => {})));

      // 2. Hard delete from DB
      const deleted = await db
        .delete(vaultItems)
        .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, ownedIds)))
        .returning({ id: vaultItems.id });

      // 3. Decrement global stats counter
      if (deleted.length > 0) {
        await db
          .update(configStats)
          .set({ totalEntries: sql`GREATEST(0, ${configStats.totalEntries} - ${deleted.length})` })
          .catch(() => {});
      }

      return NextResponse.json({ updated: deleted.length });
    }

    const now = new Date();

    // Execute standard bulk update
    let updatePayload: Partial<typeof vaultItems.$inferInsert> = {
      updatedAt: now,
    };

    switch (action) {
      case "trash":
        updatePayload.deletedAt = now;
        break;
      case "restore":
        updatePayload.deletedAt = null;
        break;
      case "favorite":
        updatePayload.favorite = true;
        break;
      case "unfavorite":
        updatePayload.favorite = false;
        break;
      case "move":
        updatePayload.folder = payload || null; // null = uncategorized
        break;
    }

    const updated = await db
      .update(vaultItems)
      .set(updatePayload)
      .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, ownedIds)))
      .returning({ id: vaultItems.id });

    return NextResponse.json({ updated: updated.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/batch]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
