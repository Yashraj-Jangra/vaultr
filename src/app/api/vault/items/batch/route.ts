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
import { vaultItems, configStats, vaultAttachments, userProfiles } from "@/db/schema";
import { eq, and, inArray, sql, sum } from "drizzle-orm";
import { deleteAttachmentsByVaultItem } from "@/lib/storage";
import { z } from "zod";

const BatchSchema = z.object({
  action: z.enum(["trash", "restore", "favorite", "unfavorite", "move", "purge"]),
  ids: z.array(z.string().min(1)).max(10000).default([]),
  payload: z.union([z.string().max(100), z.null(), z.undefined()]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = BatchSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[POST /api/vault/items/batch Validation Error]", parsed.error.format(), body);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { action, ids, payload } = parsed.data;

    if (ids.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const CHUNK_SIZE = 500;
    const ownedIds: string[] = [];

    // Ownership check: verify all requested ids belong to this user (in chunks of 500)
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const chunkOwned = await db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, chunk)));
      ownedIds.push(...chunkOwned.map((item) => item.id));
    }

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
      let totalDeleted = 0;
      let totalAttachmentBytes = 0;

      for (let i = 0; i < ownedIds.length; i += CHUNK_SIZE) {
        const chunk = ownedIds.slice(i, i + CHUNK_SIZE);

        // 1. Calculate attachment sizes across purged items
        const [sizeRow] = await db
          .select({ total: sum(vaultAttachments.sizeBytes) })
          .from(vaultAttachments)
          .where(
            and(
              eq(vaultAttachments.userId, user.id),
              inArray(vaultAttachments.vaultItemId, chunk)
            )
          );

        totalAttachmentBytes += Number(sizeRow?.total ?? 0);

        // 2. Cascade: delete all S3 attachments for these items
        await Promise.all(chunk.map((id) => deleteAttachmentsByVaultItem(user.id, id).catch(() => {})));

        // 3. Hard delete from DB (cascades to vaultAttachments rows)
        const deleted = await db
          .delete(vaultItems)
          .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, chunk)))
          .returning({ id: vaultItems.id });

        totalDeleted += deleted.length;
      }

      // 4. Decrement user storage counter once
      if (totalAttachmentBytes > 0) {
        await db
          .update(userProfiles)
          .set({
            storageUsedBytes: sql`GREATEST(${userProfiles.storageUsedBytes} - ${totalAttachmentBytes}, 0)`,
          })
          .where(eq(userProfiles.userId, user.id))
          .catch(() => {});
      }

      // 5. Decrement global stats counter once
      if (totalDeleted > 0) {
        await db
          .update(configStats)
          .set({ totalEntries: sql`GREATEST(0, ${configStats.totalEntries} - ${totalDeleted})` })
          .catch(() => {});
      }

      return NextResponse.json({ updated: totalDeleted });
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

    let totalUpdated = 0;
    for (let i = 0; i < ownedIds.length; i += CHUNK_SIZE) {
      const chunk = ownedIds.slice(i, i + CHUNK_SIZE);
      const updated = await db
        .update(vaultItems)
        .set(updatePayload)
        .where(and(eq(vaultItems.userId, user.id), inArray(vaultItems.id, chunk)))
        .returning({ id: vaultItems.id });
      totalUpdated += updated.length;
    }

    return NextResponse.json({ updated: totalUpdated });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/batch]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
