export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { deviceSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash, randomInt } from "crypto";
import { sendTemplatedEmail } from "@/lib/emailTemplates";
import { auditLog } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!user.email) {
      return NextResponse.json(
        { error: "No email address linked to this account. Add an email to enable device verification." },
        { status: 400 }
      );
    }

    const { sessionId, deviceName } = await req.json();
    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

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

    // ── Rate limit: 3 sends per rolling hour per session
    const now = Date.now();
    const windowStart = sessionRow.otpWindowStart?.getTime() ?? 0;
    let sendCount = sessionRow.otpSendCount ?? 0;
    const HOUR_MS = 60 * 60 * 1000;
    if (now - windowStart > HOUR_MS) sendCount = 0;

    if (sendCount >= 3) {
      const mins = Math.ceil((windowStart + HOUR_MS - now) / 60000);
      auditLog({ ts: new Date().toISOString(), event: "otp.rate_limited", uid: user.id, sessionId, email: user.email, meta: { sendCount, retryInMinutes: mins } });
      return NextResponse.json(
        { error: `Rate limit reached. Try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    // ── Generate OTP (6-digit, SHA-256 hash stored)
    const otp = String(randomInt(100000, 999999));
    const otpHash = createHash("sha256").update(otp).digest("hex");

    await db
      .update(deviceSessions)
      .set({
        verificationToken: otpHash,
        otpAttempts:       0,
        otpSendCount:      sendCount + 1,
        otpWindowStart:    sendCount === 0 ? new Date() : sessionRow.otpWindowStart,
        otpSentAt:         new Date(),
      })
      .where(eq(deviceSessions.sessionId, sessionId));

    // ── Send via template engine
    try {
      await sendTemplatedEmail({
        templateKey: "device_verification",
        to: user.email,
        vars: { OTP: otp, DEVICE_NAME: deviceName || "your device" },
      });
      auditLog({ ts: new Date().toISOString(), event: "otp.sent", uid: user.id, sessionId, email: user.email, meta: { deviceName: deviceName || "your device", sendCount: sendCount + 1 } });
      auditLog({ ts: new Date().toISOString(), event: "email.sent", uid: user.id, sessionId, email: user.email, meta: { templateKey: "device_verification" } });
    } catch (emailErr) {
      auditLog({ ts: new Date().toISOString(), event: "email.failed", uid: user.id, sessionId, email: user.email, meta: { templateKey: "device_verification", error: String(emailErr) } });
      throw emailErr;
    }

    return NextResponse.json({ ok: true, remaining: 3 - (sendCount + 1) });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("[send-verification-email]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
