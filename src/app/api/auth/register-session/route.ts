export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";
import { sendTemplatedEmail } from "@/lib/emailTemplates";
import { auditLog } from "@/lib/auditLog";
import { createHash, randomInt } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const body = await req.json();
    const { sessionId, deviceName, deviceType, browser, os } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const sessionRef = adminDb
      .collection("users")
      .doc(user.uid)
      .collection("sessions")
      .doc(sessionId);

    // Idempotent — if exists, just update heartbeat
    const existing = await sessionRef.get();
    if (existing.exists) {
      await sessionRef.update({ lastSeenAt: new Date() });
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
    const secSnap = await adminDb
      .collection("users")
      .doc(user.uid)
      .collection("profile")
      .doc("security")
      .get();
    const sec = secSnap.data() ?? {};
    const newDeviceEmailAlert: boolean = sec.newDeviceEmailAlert ?? true;
    const requireVerificationOnNew: boolean = sec.requireVerificationOnNew ?? false;

    // ── Check if user already has sessions (0 = first device, skip alert)
    const existingSessions = await adminDb
      .collection("users")
      .doc(user.uid)
      .collection("sessions")
      .limit(1)
      .get();
    const hasOtherSessions = !existingSessions.empty;

    const now = new Date();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    // ── Determine auto-OTP state
    let verificationRequired = requireVerificationOnNew;
    let verificationEmailSent = false;

    // Default OTP fields — overwritten if we auto-send
    let otpFields: Record<string, unknown> = {
      verificationToken: null,
      otpAttempts: 0,
      otpSendCount: 0,
      otpWindowStart: null,
      otpSentAt: null,
    };

    if (requireVerificationOnNew && user.email) {
      // Auto-generate and send OTP
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
        await sendTemplatedEmail(adminDb, {
          templateKey: "device_verification",
          to: user.email,
          vars: { OTP: otp, DEVICE_NAME: deviceName || "your device" },
        });
        verificationEmailSent = true;
        auditLog({
          ts: now.toISOString(),
          event: "email.sent",
          uid: user.uid,
          sessionId,
          email: user.email,
          meta: { templateKey: "device_verification" },
        });
      } catch (emailErr) {
        // Roll back OTP fields — code wasn't delivered
        verificationEmailSent = false;
        otpFields = {
          verificationToken: null,
          otpAttempts: 0,
          otpSendCount: 0,
          otpWindowStart: null,
          otpSentAt: null,
        };
        auditLog({
          ts: now.toISOString(),
          event: "email.failed",
          uid: user.uid,
          sessionId,
          email: user.email,
          meta: { templateKey: "device_verification", error: String(emailErr) },
        });
      }
    } else if (requireVerificationOnNew && !user.email) {
      auditLog({
        ts: now.toISOString(),
        event: "session.auto_verify_skipped",
        uid: user.uid,
        sessionId,
        ip,
        location,
        deviceName: deviceName || "Unknown Device",
        meta: { reason: "no_email", browser, os, deviceType },
      });
    }

    // ── Write session document
    await sessionRef.set({
      sessionId,
      deviceName: deviceName || "Unknown Device",
      deviceType: deviceType || "desktop",
      browser: browser || "Unknown",
      os: os || "Unknown",
      ipAddress: ip,
      location,
      createdAt: now,
      lastSeenAt: now,
      isTrusted: false,
      ...otpFields,
    });

    // ── Audit: session created
    auditLog({
      ts: now.toISOString(),
      event: "session.created",
      uid: user.uid,
      sessionId,
      ip,
      location,
      deviceName: deviceName || "Unknown Device",
      meta: { browser, os, deviceType, isFirstDevice: !hasOtherSessions },
    });

    // ── Auto-verify sent audit (after session doc exists)
    if (requireVerificationOnNew && user.email && verificationEmailSent) {
      auditLog({
        ts: now.toISOString(),
        event: "session.auto_verify_sent",
        uid: user.uid,
        sessionId,
        ip,
        location,
        deviceName: deviceName || "Unknown Device",
        email: user.email,
        meta: { browser, os, deviceType },
      });
    }

    // ── New-device alert email (fire-and-forget, never block response)
    if (hasOtherSessions && newDeviceEmailAlert && user.email) {
      sendTemplatedEmail(adminDb, {
        templateKey: "new_device_alert",
        to: user.email,
        vars: {
          DEVICE_NAME: deviceName || "Unknown Device",
          LOCATION: location || "Unknown",
          TIME: now.toUTCString(),
          SECURITY_URL: `${appUrl}/settings/security`,
        },
      })
        .then(() => {
          auditLog({
            ts: new Date().toISOString(),
            event: "session.alert_sent",
            uid: user.uid,
            sessionId,
            ip,
            email: user.email,
            meta: { templateKey: "new_device_alert" },
          });
          auditLog({
            ts: new Date().toISOString(),
            event: "email.sent",
            uid: user.uid,
            sessionId,
            email: user.email,
            meta: { templateKey: "new_device_alert" },
          });
        })
        .catch((emailErr: unknown) => {
          auditLog({
            ts: new Date().toISOString(),
            event: "email.failed",
            uid: user.uid,
            sessionId,
            email: user.email,
            meta: { templateKey: "new_device_alert", error: String(emailErr) },
          });
        });
    } else if (!hasOtherSessions) {
      auditLog({
        ts: now.toISOString(),
        event: "session.first_device",
        uid: user.uid,
        sessionId,
        ip,
        location,
        deviceName: deviceName || "Unknown Device",
        meta: { browser, os },
      });
    }

    return NextResponse.json({
      status: "created",
      sessionId,
      isTrusted: false,
      verificationRequired,
      verificationEmailSent,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[register-session]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
