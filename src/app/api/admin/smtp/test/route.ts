export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req);
    const body = await req.json();
    
    if (!adminUser.email) {
      return NextResponse.json({ error: "Your admin account doesn't have an email address." }, { status: 400 });
    }

    const { host, port, user, pass, profiles } = body;

    if (!host || !port || !user || !pass) {
      return NextResponse.json({ error: "Missing required SMTP credentials for testing." }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
    });

    let fromAddress = user;
    if (profiles && profiles.length > 0) {
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      fromAddress = `"${defaultProfile.name}" <${defaultProfile.email}>`;
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: adminUser.email,
      subject: "Vaultr SMTP Configuration Test",
      text: "This is a test email sent from your Vaultr instance to confirm that your SMTP configuration is correct and working properly.",
      html: "<p>This is a test email sent from your Vaultr instance to confirm that your SMTP configuration is correct and working properly.</p>",
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[admin/smtp/test POST]", err);
    return NextResponse.json({ error: err.message || "Failed to send test email" }, { status: 500 });
  }
}
