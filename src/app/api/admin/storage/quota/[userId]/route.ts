export const runtime = "nodejs";

/**
 * /api/admin/storage/quota/[userId]
 *
 * PATCH — set a custom storage quota for a specific user.
 *         Admin-only. Body: { quotaBytes: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PatchQuotaSchema = z.object({
  quotaBytes: z.number().int().min(0).max(107_374_182_400), // max 100 GB
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { userId } = await params;

    const body   = await req.json();
    const parsed = PatchQuotaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quota value", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    await db
      .insert(userProfiles)
      .values({ userId, storageQuotaBytes: parsed.data.quotaBytes })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set:    { storageQuotaBytes: parsed.data.quotaBytes },
      });

    return NextResponse.json({ ok: true, quotaBytes: parsed.data.quotaBytes });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/admin/storage/quota/[userId]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
