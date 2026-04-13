import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const body = await req.json();
    const { sessionId, deviceName, deviceType, browser, os } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const sessionRef = adminDb.collection("users").doc(user.uid).collection("sessions").doc(sessionId);

    // Idempotent — if already exists, just update heartbeat
    const existing = await sessionRef.get();
    if (existing.exists) {
      await sessionRef.update({ lastSeenAt: new Date() });
      return NextResponse.json({ status: "existing", sessionId });
    }

    // Capture IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // GeoIP — best-effort, silent on failure
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

    // Load user security prefs
    const secSnap = await adminDb.collection("users").doc(user.uid).collection("profile").doc("security").get();
    const sec = secSnap.data() ?? {};
    const newDeviceEmailAlert: boolean = sec.newDeviceEmailAlert ?? true;
    const requireVerificationOnNew: boolean = sec.requireVerificationOnNew ?? false;

    // Check if user has any other sessions
    const existingSessions = await adminDb.collection("users").doc(user.uid).collection("sessions").limit(1).get();
    const hasOtherSessions = !existingSessions.empty;

    const now = new Date();
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
      verificationToken: null,
      otpAttempts: 0,
      otpSendCount: 0,
      otpWindowStart: null,
    });

    // Send new-device alert email if user has other sessions and opted in
    if (hasOtherSessions && newDeviceEmailAlert && user.email) {
      sendAlertEmail(user.email, {
        deviceName: deviceName || "Unknown Device",
        location,
        time: now.toUTCString(),
        sessionId,
      }).catch(() => {/* silent */});
    }

    // Auto-send OTP if requireVerificationOnNew is set
    if (requireVerificationOnNew && user.email) {
      fetch(`${req.nextUrl.origin}/api/auth/send-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" },
        body: JSON.stringify({ sessionId, deviceName: deviceName || "Unknown Device" }),
      }).catch(() => {/* silent */});
    }

    return NextResponse.json({ status: "created", sessionId, isTrusted: false, requireVerificationOnNew });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[register-session]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Email helpers ─────────────────────────────────────────────────────────────

async function getTransporter() {
  if (!adminDb) return null;
  const snap = await adminDb.collection("adminSettings").doc("smtp").get();
  if (!snap.exists) return null;
  const s = snap.data()!;
  return nodemailer.createTransport({
    host: s.host, port: Number(s.port), secure: Number(s.port) === 465,
    auth: { user: s.user, pass: s.pass },
  });
}

async function sendAlertEmail(to: string, ctx: { deviceName: string; location: string; time: string; sessionId: string }) {
  const t = await getTransporter();
  if (!t) return;
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/security`;
  await t.sendMail({
    from: `"Vaultr Security" <no-reply@vaultr.app>`,
    to,
    subject: "⚠️ New device signed in to your Vaultr account",
    html: `<div style="font-family:sans-serif;max-width:540px;margin:auto;padding:32px 24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#fff">New device signed in</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px">A new device has signed in to your Vaultr account.</p>
      <div style="background:#171717;border:1px solid #262626;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:13px;color:#a3a3a3"><b style="color:#d4d4d4">Device:</b> ${ctx.deviceName}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#a3a3a3"><b style="color:#d4d4d4">Location:</b> ${ctx.location || "Unknown"}</p>
        <p style="margin:0;font-size:13px;color:#a3a3a3"><b style="color:#d4d4d4">Time:</b> ${ctx.time}</p>
      </div>
      <p style="font-size:13px;color:#a3a3a3">If this wasn't you, revoke the session immediately.</p>
      <a href="${url}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Review Active Sessions</a>
      <p style="margin-top:32px;font-size:11px;color:#525252">Vaultr · Do not reply to this email.</p>
    </div>`,
    text: `New device signed in.\nDevice: ${ctx.deviceName}\nLocation: ${ctx.location || "Unknown"}\nTime: ${ctx.time}\n\nReview: ${url}`,
  });
}
