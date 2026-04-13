import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

// POST — revoke a single session
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId, targetUid } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    let uidToRevoke = user.uid;

    // Admin can revoke sessions for other users
    if (targetUid && targetUid !== user.uid) {
      if (!adminAuth) return NextResponse.json({ error: "Admin SDK unavailable" }, { status: 503 });
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const decoded = await adminAuth.verifyIdToken(token);
      if (!decoded.admin) {
        return NextResponse.json({ error: "Forbidden — admin claim required" }, { status: 403 });
      }
      uidToRevoke = targetUid;
    }

    const ref = adminDb.collection("users").doc(uidToRevoke).collection("sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ ok: true, revokedSessionId: sessionId });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[revoke-session POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — bulk revoke all OTHER sessions (keep current)
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { currentSessionId } = await req.json();
    const col = adminDb.collection("users").doc(user.uid).collection("sessions");
    const all = await col.get();
    const toDelete = all.docs.filter((d) => d.id !== currentSessionId);

    // Batch delete (Firestore limit 500 per batch)
    for (let i = 0; i < toDelete.length; i += 400) {
      const batch = adminDb.batch();
      toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ ok: true, revoked: toDelete.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[revoke-session DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
