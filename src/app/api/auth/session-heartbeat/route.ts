import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const ref = adminDb.collection("users").doc(user.uid).collection("sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    await ref.update({ lastSeenAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
