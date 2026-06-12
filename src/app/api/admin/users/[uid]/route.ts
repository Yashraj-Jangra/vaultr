export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }  // Next.js 16 — dynamic params are Promises
) {
  try {
    await verifyAdminToken(req);
    const { uid } = await params;
    const { action } = await req.json();

    switch (action) {
      case "disable":
        // Upsert profile row with disabled = true
        await db
          .insert(userProfiles)
          .values({ userId: uid, disabled: true })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { disabled: true },
          });
        return NextResponse.json({ success: true, message: "User disabled" });

      case "enable":
        await db
          .insert(userProfiles)
          .values({ userId: uid, disabled: false })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { disabled: false },
          });
        return NextResponse.json({ success: true, message: "User enabled" });

      case "promote":
        await db
          .insert(userProfiles)
          .values({ userId: uid, role: "admin" })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { role: "admin" },
          });
        return NextResponse.json({ success: true, message: "User promoted to admin" });

      case "demote":
        await db
          .insert(userProfiles)
          .values({ userId: uid, role: "user" })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { role: "user" },
          });
        return NextResponse.json({ success: true, message: "User demoted from admin" });

      case "revoke_sessions":
        // Delete all sessions for the user in the database directly
        await db.delete(schema.session).where(eq(schema.session.userId, uid));
        return NextResponse.json({ success: true, message: "All active sessions revoked" });

      case "delete":
        // Better Auth admin delete — removes user + all their sessions
        await auth.api.removeUser({
          body: {
            userId: uid,
          },
          headers: req.headers,
        });
        return NextResponse.json({ success: true, message: "User deleted" });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/users/[uid] PATCH]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
