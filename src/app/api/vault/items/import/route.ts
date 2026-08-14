export const runtime = "nodejs";

/**
 * POST /api/vault/items/import
 *
 * Bulk imports and updates up to 500 vault items in a single DB transaction.
 * Supports:
 *  - Creating new items
 *  - In-place overwriting/updating of existing items (when item.id is provided)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, configStats } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const VaultItemImportSchema = z.object({
  id:            z.string().min(1).optional().nullable(),
  name:          z.string().min(1, "Name is required").max(255),
  encryptedBlob: z.string().min(1, "Encrypted blob is required").max(1_000_000),
  domain:        z.string().max(2048).optional().nullable(),
  folder:        z.string().max(100).optional().nullable(),
  template:      z.enum(["login", "card", "address", "profile", "note"]).default("login"),
  favorite:      z.boolean().default(false),
  hasTotp:       z.boolean().default(false),
  tags:          z.array(z.string().max(50)).max(20).default([]),
});

const BulkImportSchema = z.object({
  items: z.array(VaultItemImportSchema).min(1).max(500),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = BulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const item of parsed.data.items) {
      // Only treat item as update target if id is a valid server database UUID
      if (item.id && UUID_REGEX.test(item.id.trim())) {
        toUpdate.push({ ...item, id: item.id.trim() });
      } else {
        toInsert.push(item);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const insertedIds: string[] = [];
    const failedItems: Array<{ name: string; reason: string }> = [];

    // 1. Batch insert new items
    if (toInsert.length > 0) {
      try {
        const itemsToInsert = toInsert.map((item) => ({
          userId:        user.id,
          name:          item.name,
          encryptedBlob: item.encryptedBlob,
          domain:        item.domain ?? null,
          folder:        item.folder ?? null,
          template:      item.template,
          favorite:      item.favorite,
          hasTotp:       item.hasTotp,
          tags:          item.tags,
          createdAt:     new Date(),
        }));

        const inserted = await db
          .insert(vaultItems)
          .values(itemsToInsert)
          .returning({ id: vaultItems.id });
        
        insertedCount = inserted.length;
        inserted.forEach((r) => insertedIds.push(r.id));
      } catch (insertErr: any) {
        console.error("[POST /api/vault/items/import] Batch insert error:", insertErr);
        // Fallback: try individual inserts to isolate failures
        for (const item of toInsert) {
          try {
            const single = await db
              .insert(vaultItems)
              .values({
                userId:        user.id,
                name:          item.name,
                encryptedBlob: item.encryptedBlob,
                domain:        item.domain ?? null,
                folder:        item.folder ?? null,
                template:      item.template,
                favorite:      item.favorite,
                hasTotp:       item.hasTotp,
                tags:          item.tags,
                createdAt:     new Date(),
              })
              .returning({ id: vaultItems.id });
            if (single.length > 0) {
              insertedCount++;
              insertedIds.push(single[0].id);
            }
          } catch (itemErr: any) {
            failedItems.push({ name: item.name, reason: itemErr?.message || "Failed to save item" });
          }
        }
      }
    }

    // 2. In-place updates for existing items
    if (toUpdate.length > 0) {
      const now = new Date();
      for (const item of toUpdate) {
        try {
          const updated = await db
            .update(vaultItems)
            .set({
              name: item.name,
              encryptedBlob: item.encryptedBlob,
              domain: item.domain ?? null,
              folder: item.folder ?? null,
              template: item.template,
              favorite: item.favorite,
              hasTotp: item.hasTotp,
              tags: item.tags,
              updatedAt: now,
            })
            .where(and(eq(vaultItems.id, item.id), eq(vaultItems.userId, user.id)))
            .returning({ id: vaultItems.id });
          if (updated.length > 0) {
            updatedCount++;
          } else {
            // If ID wasn't found in DB, fallback create as new item
            const createdFallback = await db
              .insert(vaultItems)
              .values({
                userId:        user.id,
                name:          item.name,
                encryptedBlob: item.encryptedBlob,
                domain:        item.domain ?? null,
                folder:        item.folder ?? null,
                template:      item.template,
                favorite:      item.favorite,
                hasTotp:       item.hasTotp,
                tags:          item.tags,
                createdAt:     now,
              })
              .returning({ id: vaultItems.id });
            if (createdFallback.length > 0) {
              insertedCount++;
              insertedIds.push(createdFallback[0].id);
            }
          }
        } catch (updateErr: any) {
          failedItems.push({ name: item.name, reason: updateErr?.message || "Failed to update item" });
        }
      }
    }

    // Increment configStats counter only for new entries
    if (insertedCount > 0) {
      await db
        .insert(configStats)
        .values({ id: 1, totalEntries: insertedCount })
        .onConflictDoUpdate({
          target: configStats.id,
          set: { totalEntries: sql`${configStats.totalEntries} + ${insertedCount}` },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      inserted: insertedCount,
      updated: updatedCount,
      insertedIds,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/import]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
