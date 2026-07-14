export const runtime = "nodejs";

/**
 * /api/vault/items/[id]
 *
 * PATCH  — update a vault item (including soft-delete via deletedAt, restore via deletedAt=null)
 * DELETE — hard delete a vault item + decrement stats counter
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, configStats, vaultAttachments, userProfiles } from "@/db/schema";
import { eq, and, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { deleteAttachmentsByVaultItem } from "@/lib/storage";


// ── Validation schema for PATCH ───────────────────────────────────────────────
const PatchVaultItemSchema = z.object({
  name:          z.string().min(1).max(255).optional(),
  encryptedBlob: z.string().min(1).max(1_000_000).optional(), // 1 MB max
  domain:        z.string().max(2048).nullable().optional(),
  folder:        z.string().max(100).nullable().optional(),
  template:      z.enum(["login", "card", "address", "profile", "note"]).optional(),
  favorite:      z.boolean().optional(),
  hasTotp:       z.boolean().optional(),
  tags:          z.array(z.string().max(50)).max(20).optional(),
  deletedAt:     z.string().datetime().nullable().optional(),
  updatedAt:     z.string().datetime().optional(),
}).strict(); // reject unknown fields

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { id } = await params;
    const body = await req.json();

    // Validate input
    const parsed = PatchVaultItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }
    const data = parsed.data;

    // Build update payload using camelCase (Drizzle maps to snake_case automatically)
    const updatePayload: Partial<typeof vaultItems.$inferInsert> = {};
    if (data.name          !== undefined) updatePayload.name          = data.name;
    if (data.encryptedBlob !== undefined) updatePayload.encryptedBlob = data.encryptedBlob;
    if (data.domain        !== undefined) updatePayload.domain        = data.domain;
    if (data.folder        !== undefined) updatePayload.folder        = data.folder;
    if (data.template      !== undefined) updatePayload.template      = data.template;
    if (data.favorite      !== undefined) updatePayload.favorite      = data.favorite;
    if (data.hasTotp       !== undefined) updatePayload.hasTotp       = data.hasTotp;
    if (data.tags          !== undefined) updatePayload.tags          = data.tags;
    if ("deletedAt" in data)              updatePayload.deletedAt     = data.deletedAt ? new Date(data.deletedAt) : null;
    if (data.updatedAt     !== undefined) updatePayload.updatedAt     = new Date(data.updatedAt);
    else                                  updatePayload.updatedAt     = new Date();

    const [item] = await db
      .update(vaultItems)
      .set(updatePayload)
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, user.id)))
      .returning();

    if (!item)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/vault/items/[id]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { id } = await params;

    const deleted = await db
      .delete(vaultItems)
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, user.id)))
      .returning({ id: vaultItems.id });

    if (deleted.length === 0)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    // ── Cascade: delete all S3 attachments for this vault item ───────────────
    // Sum up the sizes first so we can decrement storageUsedBytes accurately
    const [sizeRow] = await db
      .select({ total: sum(vaultAttachments.sizeBytes) })
      .from(vaultAttachments)
      .where(
        and(
          eq(vaultAttachments.vaultItemId, id),
          eq(vaultAttachments.userId, user.id)
        )
      );

    const totalAttachmentBytes = Number(sizeRow?.total ?? 0);

    // Delete from S3 (the DB rows cascade-delete when vault_items row is gone,
    // but we delete S3 objects ourselves since ON DELETE CASCADE doesn't reach S3)
    await deleteAttachmentsByVaultItem(user.id, id).catch(() => {});

    // Decrement user storage counter if there were attachments
    if (totalAttachmentBytes > 0) {
      await db
        .update(userProfiles)
        .set({
          storageUsedBytes: sql`GREATEST(${userProfiles.storageUsedBytes} - ${totalAttachmentBytes}, 0)`,
        })
        .where(eq(userProfiles.userId, user.id))
        .catch(() => {});
    }

    // Decrement stats counter
    await db
      .insert(configStats)
      .values({ id: 1, totalEntries: 0 })
      .onConflictDoUpdate({
        target: configStats.id,
        set: { totalEntries: sql`GREATEST(${configStats.totalEntries} - 1, 0)` },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/vault/items/[id]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
