export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { auditLog } from "@/lib/auditLog";

// ─── POST — revoke a single session ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb || !adminAuth)
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId, targetUid } = await req.json();
    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    let uidToRevoke = user.uid;

    // Admin can revoke sessions for other users
    if (targetUid && targetUid !== user.uid) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const decoded = await adminAuth.verifyIdToken(token);
      if (!decoded.admin) {
        return NextResponse.json({ error: "Forbidden — admin claim required" }, { status: 403 });
      }
      uidToRevoke = targetUid;
    }

    const ref = adminDb
      .collection("users")
      .doc(uidToRevoke)
      .collection("sessions")
      .doc(sessionId);

    const snap = await ref.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const sessionData = snap.data();

    // ── 1. Delete the Firestore session document
    await ref.delete();

    // ── 2. Revoke the user's Firebase refresh tokens.
    //       This prevents the target device from obtaining new ID tokens.
    //       The current ID token remains valid until its 1-hour TTL expires,
    //       but the heartbeat will detect the missing doc and force a client logout
    //       within the next heartbeat cycle (≤ 5 minutes).
    //
    //       NOTE: revokeRefreshTokens is user-scoped in Firebase, not per-device.
    //       If the revoker is the same user (revoking a foreign device), we must
    //       revoke the whole user's tokens. The revoking device's own session doc
    //       still exists, so its heartbeat is unaffected, but it will need to
    //       force-refresh its ID token to get a new one past the revocation checkpoint.
    try {
      await adminAuth.revokeRefreshTokens(uidToRevoke);
    } catch (tokenErr) {
      // Non-fatal — the Firestore doc is already gone so the heartbeat will
      // catch the revocation within 5 minutes even without token invalidation.
      console.warn("[revoke-session] revokeRefreshTokens failed:", tokenErr);
    }

    auditLog({
      ts: new Date().toISOString(),
      event: uidToRevoke === user.uid ? "session.revoked" : "session.revoked_other",
      uid: user.uid,
      sessionId,
      ip,
      deviceName: sessionData?.deviceName as string | undefined,
      meta: {
        revokedUid: uidToRevoke,
        revokedByAdmin: uidToRevoke !== user.uid,
        tokenRevoked: true,
      },
    });

    return NextResponse.json({
      ok: true,
      revokedSessionId: sessionId,
      // Tell the caller whether they need to force-refresh their own token.
      // They do whenever we touch the same uid's tokens.
      needsTokenRefresh: uidToRevoke === user.uid,
    });
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
    if (!adminDb || !adminAuth)
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { currentSessionId } = await req.json();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const col = adminDb.collection("users").doc(user.uid).collection("sessions");
    const all = await col.get();
    const toDelete = all.docs.filter((d) => d.id !== currentSessionId);

    if (toDelete.length === 0) {
      return NextResponse.json({ ok: true, revoked: 0, needsTokenRefresh: false });
    }

    // ── 1. Batch delete all other session documents (Firestore limit 500/batch)
    for (let i = 0; i < toDelete.length; i += 400) {
      const batch = adminDb.batch();
      toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // ── 2. Revoke refresh tokens for this user.
    //       The calling device must immediately force-refresh its own ID token
    //       after this call — the client signals this via needsTokenRefresh: true.
    try {
      await adminAuth.revokeRefreshTokens(user.uid);
    } catch (tokenErr) {
      console.warn("[revoke-session DELETE] revokeRefreshTokens failed:", tokenErr);
    }

    auditLog({
      ts: new Date().toISOString(),
      event: "session.revoke_all",
      uid: user.uid,
      sessionId: currentSessionId as string | undefined,
      ip,
      meta: { revokedCount: toDelete.length, tokenRevoked: true },
    });

    return NextResponse.json({
      ok: true,
      revoked: toDelete.length,
      // The calling device must call getIdToken(true) immediately to get a token
      // issued after the revocation timestamp — otherwise its next API call will 401.
      needsTokenRefresh: true,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[revoke-session DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
