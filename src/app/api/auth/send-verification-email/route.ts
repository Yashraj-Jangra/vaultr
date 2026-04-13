import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/firebase/verifyUser";
import { adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";
import { createHash, randomInt } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    if (!adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const { sessionId, deviceName } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    if (!user.email) return NextResponse.json({ error: "No email address on account" }, { status: 400 });

    const ref = adminDb.collection("users").doc(user.uid).collection("sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const data = snap.data()!;

    // ── Rate limit: 3 sends per hour per session
    const now = Date.now();
    const windowStart: number = data.otpWindowStart?.toMillis?.() ?? 0;
    let sendCount: number = data.otpSendCount ?? 0;
    const HOUR_MS = 60 * 60 * 1000;
    if (now - windowStart > HOUR_MS) sendCount = 0; // reset old window

    if (sendCount >= 3) {
      const mins = Math.ceil((windowStart + HOUR_MS - now) / 60000);
      return NextResponse.json(
        { error: `Rate limit reached. Try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    // ── Generate OTP
    const otp = String(randomInt(100000, 999999));
    const otpHash = createHash("sha256").update(otp).digest("hex");

    await ref.update({
      verificationToken: otpHash,
      otpAttempts: 0,
      otpSendCount: sendCount + 1,
      otpWindowStart: sendCount === 0 ? new Date() : data.otpWindowStart,
      otpSentAt: new Date(),
    });

    // ── Load SMTP
    const smtpSnap = await adminDb.collection("adminSettings").doc("smtp").get();
    if (!smtpSnap.exists) {
      return NextResponse.json(
        { error: "Email not configured. Ask your admin to set up SMTP in the Admin Panel." },
        { status: 503 }
      );
    }
    const smtp = smtpSnap.data()!;
    const transporter = nodemailer.createTransport({
      host: smtp.host, port: Number(smtp.port), secure: Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transporter.sendMail({
      from: `"Vaultr Security" <${smtp.user}>`,
      to: user.email,
      subject: `${otp} — Your Vaultr device verification code`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff">Verify your device</h2>
        <p style="color:#a3a3a3;font-size:14px;margin:0 0 28px">Enter this code in Vaultr to verify <b style="color:#d4d4d4">${deviceName || "your device"}</b>.</p>
        <div style="background:#171717;border:1px solid #3f3f3f;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px">
          <span style="font-family:monospace;font-size:40px;font-weight:700;letter-spacing:10px;color:#fff">${otp}</span>
        </div>
        <p style="font-size:13px;color:#737373">Expires in <b style="color:#a3a3a3">15 minutes</b>. If you didn't request this, your vault is safe — ignore this email.</p>
        <p style="margin-top:32px;font-size:11px;color:#525252">Vaultr · Zero-knowledge vault</p>
      </div>`,
      text: `Your Vaultr verification code: ${otp}\n\nDevice: ${deviceName || "Unknown"}\nExpires in 15 minutes.`,
    });

    return NextResponse.json({ ok: true, remaining: 3 - (sendCount + 1) });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[send-verification-email]", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
