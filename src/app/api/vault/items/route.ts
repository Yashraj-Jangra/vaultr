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
import { z } from "zod";

// ── Validation schema ──────────────────────────────────────────────────────────
const CreateVaultItemSchema = z.object({
  name:          z.string().min(1, "Name is required").max(255),
  encryptedBlob: z.string().min(1, "Encrypted blob is required").max(1_000_000), // 1 MB max
  domain:        z.string().max(2048).optional().nullable(),
  folder:        z.string().max(100).optional().nullable(),
  template:      z.enum(["login", "card", "address", "profile", "note"]).default("login"),
  favorite:      z.boolean().default(false),
  hasTotp:       z.boolean().default(false),
  tags:          z.array(z.string().max(50)).max(20).default([]),
});

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

    // Validate input
    const parsed = CreateVaultItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }
    const data = parsed.data;

    const [item] = await db
      .insert(vaultItems)
      .values({
        userId:        user.id,
        name:          data.name,
        encryptedBlob: data.encryptedBlob,
        domain:        data.domain ?? null,
        folder:        data.folder ?? null,
        template:      data.template,
        favorite:      data.favorite,
        hasTotp:       data.hasTotp,
        tags:          data.tags,
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
