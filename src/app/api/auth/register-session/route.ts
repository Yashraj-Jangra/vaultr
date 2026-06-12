export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { deviceSessions, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendTemplatedEmail } from "@/lib/emailTemplates";
import { auditLog } from "@/lib/auditLog";
import { createHash, randomInt } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();
    const { sessionId, deviceName, deviceType, browser, os } = body;

    if (!sessionId)
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // ── Check if session already exists (idempotent)
    const [existing] = await db
      .select({ sessionId: deviceSessions.sessionId })
      .from(deviceSessions)
      .where(
        and(
          eq(deviceSessions.sessionId, sessionId),
          eq(deviceSessions.userId, user.id)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(deviceSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(deviceSessions.sessionId, sessionId));
      return NextResponse.json({ status: "existing", sessionId });
    }

    // ── Capture IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // ── GeoIP — best-effort, silent on failure
    let location = "";
    if (ip && ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("::")) {
      try {
        const geo = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, {
          signal: AbortSignal.timeout(3000),
        });
        if (geo.ok) {
          const g = await geo.json();
          location = [g.city, g.country].filter(Boolean).join(", ");
        }
      } catch { /* silent */ }
    }

    // ── Load user security prefs
    const [profile] = await db
      .select({
        newDeviceEmailAlert:      userProfiles.newDeviceEmailAlert,
        requireVerificationOnNew: userProfiles.requireVerificationOnNew,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const newDeviceEmailAlert:      boolean = profile?.newDeviceEmailAlert      ?? true;
    const requireVerificationOnNew: boolean = profile?.requireVerificationOnNew ?? false;

    // ── Check if user already has sessions (0 = first device, skip alert)
    const [firstSession] = await db
      .select({ sessionId: deviceSessions.sessionId })
      .from(deviceSessions)
      .where(eq(deviceSessions.userId, user.id))
      .limit(1);
    const hasOtherSessions = !!firstSession;

    const now = new Date();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const verificationRequired = requireVerificationOnNew;
    let verificationEmailSent = false;

    // ── OTP fields
    let otpFields = {
      verificationToken: null as string | null,
      otpAttempts: 0,
      otpSendCount: 0,
      otpWindowStart: null as Date | null,
      otpSentAt: null as Date | null,
    };

    if (requireVerificationOnNew && user.email) {
      const otp = String(randomInt(100000, 999999));
      const otpHash = createHash("sha256").update(otp).digest("hex");
      otpFields = {
        verificationToken: otpHash,
        otpAttempts: 0,
        otpSendCount: 1,
        otpWindowStart: now,
        otpSentAt: now,
      };

      try {
        await sendTemplatedEmail({
          templateKey: "device_verification",
          to: user.email,
          vars: { OTP: otp, DEVICE_NAME: deviceName || "your device" },
        });
        verificationEmailSent = true;
        auditLog({ ts: now.toISOString(), event: "email.sent", uid: user.id, sessionId, email: user.email, meta: { templateKey: "device_verification" } });
      } catch (emailErr) {
        verificationEmailSent = false;
        otpFields = { verificationToken: null, otpAttempts: 0, otpSendCount: 0, otpWindowStart: null, otpSentAt: null };
        auditLog({ ts: now.toISOString(), event: "email.failed", uid: user.id, sessionId, email: user.email, meta: { templateKey: "device_verification", error: String(emailErr) } });
      }
    } else if (requireVerificationOnNew && !user.email) {
      auditLog({ ts: now.toISOString(), event: "session.auto_verify_skipped", uid: user.id, sessionId, ip, location, deviceName: deviceName || "Unknown Device", meta: { reason: "no_email", browser, os, deviceType } });
    }

    // ── Write session row
    await db.insert(deviceSessions).values({
      sessionId,
      userId:            user.id,
      deviceName:        deviceName || "Unknown Device",
      deviceType:        deviceType || "desktop",
      browser:           browser    || "Unknown",
      os:                os         || "Unknown",
      ipAddress:         ip,
      location,
      createdAt:         now,
      lastSeenAt:        now,
      isTrusted:         false,
      ...otpFields,
    });

    auditLog({ ts: now.toISOString(), event: "session.created", uid: user.id, sessionId, ip, location, deviceName: deviceName || "Unknown Device", meta: { browser, os, deviceType, isFirstDevice: !hasOtherSessions } });

    // ── New-device alert email (fire-and-forget)
    if (hasOtherSessions && newDeviceEmailAlert && user.email) {
      sendTemplatedEmail({
        templateKey: "new_device_alert",
        to: user.email,
        vars: { DEVICE_NAME: deviceName || "Unknown Device", LOCATION: location || "Unknown", TIME: now.toUTCString(), SECURITY_URL: `${appUrl}/settings/security` },
      })
        .then(() => { auditLog({ ts: new Date().toISOString(), event: "email.sent", uid: user.id, sessionId, email: user.email ?? undefined, meta: { templateKey: "new_device_alert" } }); })
        .catch((e: unknown) => { auditLog({ ts: new Date().toISOString(), event: "email.failed", uid: user.id, sessionId, email: user.email ?? undefined, meta: { templateKey: "new_device_alert", error: String(e) } }); });
    } else if (!hasOtherSessions) {
      auditLog({ ts: now.toISOString(), event: "session.first_device", uid: user.id, sessionId, ip, location, deviceName: deviceName || "Unknown Device", meta: { browser, os } });
    }

    return NextResponse.json({ status: "created", sessionId, isTrusted: false, verificationRequired, verificationEmailSent });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[register-session]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
