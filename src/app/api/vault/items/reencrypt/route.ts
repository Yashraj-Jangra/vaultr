export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();
    const { items } = body; // Array of { id: string, encryptedBlob: string }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(vaultItems)
          .set({ encryptedBlob: item.encryptedBlob, updatedAt: new Date() })
          .where(and(eq(vaultItems.id, item.id), eq(vaultItems.userId, user.id)));
      }
    });

    return NextResponse.json({ success: true, count: items.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/items/reencrypt]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
