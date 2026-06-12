export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { deviceSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { auditLog } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const { sessionId, otp } = await req.json();

    if (!sessionId || !otp)
      return NextResponse.json({ error: "sessionId and otp required" }, { status: 400 });

    const [sessionRow] = await db
      .select()
      .from(deviceSessions)
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, user.id)
        )
      )
      .limit(1);

    if (!sessionRow)
      return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (sessionRow.isTrusted)
      return NextResponse.json({ ok: true, already: true });

    if (!sessionRow.verificationToken) {
      return NextResponse.json(
        { error: "No verification code sent. Request a new code." },
        { status: 400 }
      );
    }

    // ── Attempt lockout
    const attempts = sessionRow.otpAttempts ?? 0;
    if (attempts >= 5) {
      auditLog({ ts: new Date().toISOString(), event: "device.verify_locked", uid: user.id, sessionId, ip, deviceName: sessionRow.deviceName ?? undefined, meta: { attempts } });
      return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    }

    // ── Expiry check — 15 minutes
    const sentAt = sessionRow.otpSentAt;
    if (sentAt && Date.now() - sentAt.getTime() > 15 * 60 * 1000) {
      auditLog({ ts: new Date().toISOString(), event: "device.verify_expired", uid: user.id, sessionId, ip, deviceName: sessionRow.deviceName ?? undefined, meta: { sentAt: sentAt.toISOString() } });
      return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
    }

    // ── Compare hashes
    const hash = createHash("sha256").update(String(otp)).digest("hex");
    if (hash !== sessionRow.verificationToken) {
      await db
        .update(deviceSessions)
        .set({ otpAttempts: attempts + 1 })
        .where(eq(deviceSessions.sessionId, sessionId));

      const remaining = 4 - attempts;
      auditLog({ ts: new Date().toISOString(), event: "device.verify_failed", uid: user.id, sessionId, ip, deviceName: sessionRow.deviceName ?? undefined, meta: { attempts: attempts + 1, remaining } });
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`, remaining },
        { status: 400 }
      );
    }

    // ✅ Success — mark as trusted, clear OTP fields
    await db
      .update(deviceSessions)
      .set({
        isTrusted:         true,
        verificationToken: null,
        otpAttempts:       0,
      })
      .where(eq(deviceSessions.sessionId, sessionId));

    auditLog({ ts: new Date().toISOString(), event: "device.verified", uid: user.id, sessionId, ip, deviceName: sessionRow.deviceName ?? undefined, meta: { attempts } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[verify-device]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
