export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { terminateSession } from "@/lib/sessionMeta";
import { db } from "@/db";
import { session } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * DELETE /api/settings/sessions/[id]
 * Revokes a specific session belonging to the authenticated user.
 * Cannot revoke the current session (use sign-out instead).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await verifyUserToken(req);
    const { id: sessionId } = await params;

    // Cannot revoke the current session via this endpoint
    if (sessionId === me.sessionId) {
      return NextResponse.json(
        { error: "Cannot revoke your current session. Use sign out instead." },
        { status: 400 }
      );
    }

    // Verify the session belongs to this user before deleting
    const [owned] = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, sessionId), eq(session.userId, me.id)))
      .limit(1);

    if (!owned) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    await terminateSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[settings/sessions/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
