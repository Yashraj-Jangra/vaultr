export const runtime = "nodejs";

/**
 * /api/vault/items
 *
 * GET  — list all vault items for current user
 * POST — create a new vault item
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, configStats } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const items = await db
      .select()
      .from(vaultItems)
      .where(eq(vaultItems.userId, user.id));

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/items]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const [item] = await db
      .insert(vaultItems)
      .values({
        userId:        user.id,
        name:          body.name,
        encryptedBlob: body.encryptedBlob,
        domain:        body.domain ?? null,
        folder:        body.folder ?? null,
        template:      body.template ?? "login",
        favorite:      body.favorite ?? false,
        hasTotp:       body.hasTotp ?? false,
        tags:          body.tags ?? [],
        createdAt:     new Date(),
      })
      .returning();

    // Increment total entries counter
    await db
      .insert(configStats)
      .values({ id: 1, totalEntries: 1 })
      .onConflictDoUpdate({
        target: configStats.id,
        set: { totalEntries: sql`${configStats.totalEntries} + 1` },
      })
      .catch(() => {}); // non-fatal

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    await db.delete(vaultItems).where(eq(vaultItems.userId, user.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/vault/items]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
