export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { user, account, session, vaultItems, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user authentication
    const authedUser = await verifyUserToken(req);

    // 2. Check admin role
    const [profile] = await db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(eq(userProfiles.userId, authedUser.id));

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 3. Check confirmation phrase
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "TRUNCATE ALL DATA") {
      return NextResponse.json(
        { error: 'Confirmation phrase "TRUNCATE ALL DATA" is required' },
        { status: 400 }
      );
    }

    // Delete all vault items first due to foreign keys
    await db.delete(vaultItems);
    await db.delete(session);
    await db.delete(account);
    await db.delete(user);

    return NextResponse.json({ success: true, message: "All system data truncated successfully." });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[truncate POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
