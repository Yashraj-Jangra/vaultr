export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb)
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId } = await req.json();
    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const ref = adminDb
      .collection("users")
      .doc(user.uid)
      .collection("sessions")
      .doc(sessionId);

    const snap = await ref.get();

    // ── Session was revoked (doc deleted by another device or admin) ──────────
    // Return { revoked: true } with HTTP 200 so the client can handle it gracefully
    // (a 404 would be silently swallowed; a 200 lets the heartbeat logic branch).
    if (!snap.exists) {
      return NextResponse.json({ ok: false, revoked: true });
    }

    await ref.update({ lastSeenAt: new Date() });
    return NextResponse.json({ ok: true, revoked: false });
  } catch (err) {
    if (err instanceof Response) return err;
    // Silent on internal errors — heartbeat must never crash the client
    return NextResponse.json({ ok: false, revoked: false }, { status: 500 });
  }
}
