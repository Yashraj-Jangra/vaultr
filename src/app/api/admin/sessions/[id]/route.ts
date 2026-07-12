export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { terminateSession } from "@/lib/sessionMeta";
import { db } from "@/db";
import { session } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/admin/sessions/[id]
 * Admin force-terminates any session by ID. Silent — no email to user.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { id: sessionId } = await params;

    // Confirm the session exists before attempting deletion
    const [existing] = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.id, sessionId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await terminateSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/sessions/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
