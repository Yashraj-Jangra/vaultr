export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { deviceSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const { sessionId } = await req.json();

    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const [session] = await db
      .select({ sessionId: deviceSessions.sessionId })
      .from(deviceSessions)
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, user.id)
        )
      )
      .limit(1);

    // Session was revoked (deleted by another device or admin)
    if (!session) {
      return NextResponse.json({ ok: false, revoked: true });
    }

    await db
      .update(deviceSessions)
      .set({ lastSeenAt: new Date() })
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, user.id)
        )
      );

    return NextResponse.json({ ok: true, revoked: false });
  } catch (err) {
    if (err instanceof Response) return err;
    // Silent on internal errors — heartbeat must never crash the client
    return NextResponse.json({ ok: false, revoked: false }, { status: 500 });
  }
}
