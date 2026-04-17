export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";
import { createHash } from "crypto";
import { auditLog } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId, otp } = await req.json();
    if (!sessionId || !otp) {
      return NextResponse.json({ error: "sessionId and otp required" }, { status: 400 });
    }

    const ref = adminDb.collection("users").doc(user.uid).collection("sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const data = snap.data()!;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (data.isTrusted) return NextResponse.json({ ok: true, already: true });

    if (!data.verificationToken) {
      return NextResponse.json(
        { error: "No verification code sent. Request a new code." },
        { status: 400 }
      );
    }

    // ── Attempt lockout
    const attempts: number = data.otpAttempts ?? 0;
    if (attempts >= 5) {
      auditLog({
        ts: new Date().toISOString(),
        event: "device.verify_locked",
        uid: user.uid,
        sessionId,
        ip,
        deviceName: data.deviceName as string | undefined,
        meta: { attempts },
      });
      return NextResponse.json(
        { error: "Too many attempts. Request a new code." },
        { status: 429 }
      );
    }

    // ── Expiry check — 15 minutes
    const sentAt: Date | null = data.otpSentAt?.toDate?.() ?? null;
    if (sentAt && Date.now() - sentAt.getTime() > 15 * 60 * 1000) {
      auditLog({
        ts: new Date().toISOString(),
        event: "device.verify_expired",
        uid: user.uid,
        sessionId,
        ip,
        deviceName: data.deviceName as string | undefined,
        meta: { sentAt: sentAt.toISOString() },
      });
      return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
    }

    // ── Compare hashes
    const hash = createHash("sha256").update(String(otp)).digest("hex");
    if (hash !== data.verificationToken) {
      await ref.update({ otpAttempts: attempts + 1 });
      const remaining = 4 - attempts;
      auditLog({
        ts: new Date().toISOString(),
        event: "device.verify_failed",
        uid: user.uid,
        sessionId,
        ip,
        deviceName: data.deviceName as string | undefined,
        meta: { attempts: attempts + 1, remaining },
      });
      return NextResponse.json(
        {
          error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
          remaining,
        },
        { status: 400 }
      );
    }

    // ✅ Success
    await ref.update({
      isTrusted: true,
      verificationToken: null,
      otpAttempts: 0,
      trustedAt: new Date(),
    });

    auditLog({
      ts: new Date().toISOString(),
      event: "device.verified",
      uid: user.uid,
      sessionId,
      ip,
      deviceName: data.deviceName as string | undefined,
      meta: { attempts },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[verify-device]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
