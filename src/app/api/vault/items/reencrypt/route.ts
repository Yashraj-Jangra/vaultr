export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const ReencryptItemSchema = z.object({
  id:            z.string().uuid("Each item must have a valid UUID id"),
  encryptedBlob: z.string().min(1).max(1_000_000), // 1 MB max per item
});

const ReencryptBodySchema = z.object({
  items: z
    .array(ReencryptItemSchema)
    .min(1, "At least one item required")
    .max(5000, "Maximum 5000 items per re-encrypt call"),
});

// Batch size to avoid mega-transactions locking the DB
const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    // Validate input shape and limits
    const parsed = ReencryptBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { items } = parsed.data;

    // Process in batches of BATCH_SIZE to prevent giant transactions
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await db.transaction(async (tx) => {
        for (const item of batch) {
          await tx
            .update(vaultItems)
            .set({ encryptedBlob: item.encryptedBlob, updatedAt: new Date() })
            .where(and(eq(vaultItems.id, item.id), eq(vaultItems.userId, user.id)));
        }
      });
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/reencrypt]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
