export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { terminateUserSessions } from "@/lib/sessionMeta";

/**
 * DELETE /api/admin/sessions/user/[uid]
 * Admin terminates ALL sessions for a specific user. Silent.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { uid } = await params;

    const result = await terminateUserSessions(uid);
    return NextResponse.json({ terminated: result.terminated });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/sessions/user/[uid] DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
