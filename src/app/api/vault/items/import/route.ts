export const runtime = "nodejs";

/**
 * POST /api/vault/items/import
 *
 * Bulk imports up to 500 vault items in a single DB transaction.
 * Solves N+1 API call bottlenecks and request rate-limiting during large CSV/JSON imports.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, configStats } from "@/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";

const VaultItemImportSchema = z.object({
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

    const itemsToInsert = parsed.data.items.map((item) => ({
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

    // Batch insert items in single DB transaction
    const inserted = await db
      .insert(vaultItems)
      .values(itemsToInsert)
      .returning({ id: vaultItems.id });

    const insertedCount = inserted.length;

    // Increment configStats entry counter once for total count
    if (insertedCount > 0) {
      await db
        .insert(configStats)
        .values({ id: 1, totalEntries: insertedCount })
        .onConflictDoUpdate({
          target: configStats.id,
          set: { totalEntries: sql`${configStats.totalEntries} + ${insertedCount}` },
        })
        .catch(() => {}); // non-fatal
    }

    return NextResponse.json({ inserted: insertedCount });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/import]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
