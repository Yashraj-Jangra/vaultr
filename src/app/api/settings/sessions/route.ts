export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { getUserSessions, terminateUserSessions } from "@/lib/sessionMeta";

/**
 * GET /api/settings/sessions
 * Returns all active sessions for the current user with full metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUserToken(req);
    const sessions = await getUserSessions(me.id, me.sessionId);
    return NextResponse.json({ sessions });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[settings/sessions GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/sessions
 * Revokes all sessions for the current user except the current one.
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = await verifyUserToken(req);
    const result = await terminateUserSessions(me.id, me.sessionId);
    return NextResponse.json({ terminated: result.terminated });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[settings/sessions DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
