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
import { vaultItems, configStats } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { id } = await params;
    const body = await req.json();

    // Build update payload — map camelCase → snake_case for DB
    const updatePayload: Record<string, unknown> = {};
    if (body.name          !== undefined) updatePayload.name           = body.name;
    if (body.encryptedBlob !== undefined) updatePayload.encrypted_blob = body.encryptedBlob;
    if (body.domain        !== undefined) updatePayload.domain         = body.domain;
    if (body.folder        !== undefined) updatePayload.folder         = body.folder;
    if (body.template      !== undefined) updatePayload.template       = body.template;
    if (body.favorite      !== undefined) updatePayload.favorite       = body.favorite;
    if (body.hasTotp       !== undefined) updatePayload.has_totp       = body.hasTotp;
    if (body.tags          !== undefined) updatePayload.tags           = body.tags;
    if ("deletedAt" in body)              updatePayload.deleted_at     = body.deletedAt ? new Date(body.deletedAt) : null;
    if (body.updatedAt     !== undefined) updatePayload.updated_at     = new Date(body.updatedAt);
    else                                  updatePayload.updated_at     = new Date();

    const [item] = await db
      .update(vaultItems)
      .set(updatePayload as Parameters<typeof db.update>[0] extends unknown ? never : never)
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
