export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { createTransporter, WRAPPER, getBrandLogoAttachment } from "@/lib/emailTemplates";
import { auditLog } from "@/lib/auditLog";
import nodemailer from "nodemailer";
import { safeError } from "@/lib/safeError";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const conn = await createTransporter();
    if (!conn) return NextResponse.json({ profiles: [] });
    return NextResponse.json({ profiles: conn.smtp.profiles ?? [] });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/email GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req);
    const body = await req.json();
    const { fromProfileId, to, subject, message } = body;

    if (!to || !subject || !message)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // Load SMTP settings from PostgreSQL via createTransporter helper
    const conn = await createTransporter();
    if (!conn)
      return NextResponse.json({ error: "SMTP settings not configured! Please configure them in Settings." }, { status: 500 });

    let fromAddress = conn.fromAddress;
    if (fromProfileId) {
      const profile = conn.smtp.profiles?.find((p) => p.id === fromProfileId);
      if (profile) fromAddress = `"${profile.name}" <${profile.email}>`;
    }

    const info = await conn.transporter.sendMail({
      from:    fromAddress,
      to,
      subject,
      html:    WRAPPER(`
        <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">${subject}</h2>
        <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:22px 24px;margin-bottom:16px;">
          <p style="margin:0;font-size:14px;color:#f4f4f5;line-height:1.6;white-space:pre-wrap;">${message}</p>
        </div>`, "SYSTEM MESSAGE"),
      text:    message,
      attachments: getBrandLogoAttachment(),
    });

    // Log to audit file
    auditLog({
      ts:    new Date().toISOString(),
      event: "email.sent",
      uid:   adminUser.id,
      email: adminUser.email ?? undefined,
      meta:  { to, subject, messageId: info.messageId, fromProfileId },
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/email POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
