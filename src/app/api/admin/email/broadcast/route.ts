export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { createTransporter } from "@/lib/emailTemplates";
import { db } from "@/db";
import { user, emailLogs } from "@/db/schema";
import { auditLog } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req);
    const body = await req.json();
    const { fromProfileId, subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const conn = await createTransporter();
    if (!conn) {
      return NextResponse.json({ error: "SMTP settings not configured!" }, { status: 500 });
    }

    let fromAddress = conn.fromAddress;
    if (fromProfileId) {
      const profile = conn.smtp.profiles?.find((p: any) => p.id === fromProfileId);
      if (profile) fromAddress = `"${profile.name}" <${profile.email}>`;
    }

    // Fetch all users
    const allUsers = await db.select().from(user);
    const results = [];

    for (const u of allUsers) {
      if (!u.email) continue;
      
      try {
        await conn.transporter.sendMail({
          from: fromAddress,
          to: u.email,
          subject,
          html: message.replace(/\n/g, "<br>"),
          text: message,
        });

        // Insert success log
        await db.insert(emailLogs).values({
          recipient: u.email,
          subject,
          status: "sent"
        });

        results.push({ email: u.email, status: "sent" });
      } catch (e: any) {
        // Insert failure log
        await db.insert(emailLogs).values({
          recipient: u.email,
          subject,
          status: "failed",
          error: e.message
        });
        results.push({ email: u.email, status: "failed", error: e.message });
      }
    }

    // System audit log
    auditLog({
      ts: new Date().toISOString(),
      event: "email.broadcast",
      uid: adminUser.id,
      email: adminUser.email ?? undefined,
      meta: { subject, count: allUsers.length },
    });

    return NextResponse.json({ success: true, count: allUsers.length, results });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/email/broadcast POST]", err);
    return NextResponse.json({ error: (err as Error).message || "Internal Server Error" }, { status: 500 });
  }
}
