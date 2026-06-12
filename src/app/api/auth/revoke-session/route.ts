export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { deviceSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auditLog } from "@/lib/auditLog";

// ─── POST — revoke a single session ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const { sessionId, targetUid } = await req.json();

    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Determine whose session to revoke
    let uidToRevoke = user.id;

    if (targetUid && targetUid !== user.id) {
      // Admin revoking another user's session — verifyAdminToken is not imported
      // here to avoid circular deps; check role inline
      const { db: _db } = await import("@/db");
      const { userProfiles } = await import("@/db/schema");
      const [profile] = await _db
        .select({ role: userProfiles.role })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
      }
      uidToRevoke = targetUid as string;
    }

    const [session] = await db
      .select({ deviceName: deviceSessions.deviceName })
      .from(deviceSessions)
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, uidToRevoke)
        )
      )
      .limit(1);

    if (!session)
      return NextResponse.json({ error: "Session not found" }, { status: 404 });

    await db
      .delete(deviceSessions)
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, uidToRevoke)
        )
      );

    auditLog({
      ts: new Date().toISOString(),
      event: uidToRevoke === user.id ? "session.revoked" : "session.revoked_other",
      uid: user.id,
      sessionId,
      ip,
      deviceName: session.deviceName ?? undefined,
      meta: { revokedUid: uidToRevoke, revokedByAdmin: uidToRevoke !== user.id },
    });

    return NextResponse.json({ ok: true, revokedSessionId: sessionId });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[revoke-session POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE — bulk revoke all OTHER sessions (keep current) ──────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const { currentSessionId } = await req.json();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const { ne, and } = await import("drizzle-orm");

    const deleted = await db
      .delete(deviceSessions)
      .where(
        and(
          eq(deviceSessions.userId, user.id),
          ne(deviceSessions.sessionId, currentSessionId ?? "")
        )
      )
      .returning({ sessionId: deviceSessions.sessionId });

    auditLog({
      ts: new Date().toISOString(),
      event: "session.revoke_all",
      uid: user.id,
      sessionId: currentSessionId as string | undefined,
      ip,
      meta: { revokedCount: deleted.length },
    });

    return NextResponse.json({ ok: true, revoked: deleted.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[revoke-session DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
