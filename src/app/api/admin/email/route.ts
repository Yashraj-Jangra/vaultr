export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/firebase/verifyAdmin";
import { adminDb } from "@/lib/firebase/admin";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req);
    if (!adminDb) return NextResponse.json({ error: "Firebase Admin DB not initialized" }, { status: 503 });
    const body = await req.json();
    
    const { fromProfileId, to, subject, message } = body;
    
    if (!to || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Load SMTP settings from Firestore
    const smtpSnap = await adminDb.collection("adminSettings").doc("smtp").get();
    if (!smtpSnap.exists) {
      return NextResponse.json({ error: "SMTP settings not configured! Please configure them in Settings." }, { status: 500 });
    }
    
    const smtpData = smtpSnap.data()!;
    const transporter = nodemailer.createTransport({
      host: smtpData.host,
      port: Number(smtpData.port),
      secure: Number(smtpData.port) === 465, // Use secure connection for port 465
      auth: {
        user: smtpData.user,
        pass: smtpData.pass,
      },
    });

    // Resolve Sender Profile
    let fromEmail = smtpData.user;
    let fromName = "Vaultr Admin";
    
    if (smtpData.profiles && Array.isArray(smtpData.profiles)) {
      type SmtpProfile = { id: string, name: string, email: string, isDefault: boolean };
      const selectedProfile = smtpData.profiles.find((p: SmtpProfile) => p.id === fromProfileId) 
                              || smtpData.profiles.find((p: SmtpProfile) => p.isDefault) 
                              || smtpData.profiles[0];
                              
      if (selectedProfile) {
        fromEmail = selectedProfile.email;
        fromName = selectedProfile.name;
      }
    } else {
      // Legacy fallback
      fromName = smtpData.fromName || "Vaultr Admin";
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to, // Can be a comma separated list
      subject,
      html: message.replace(/\n/g, "<br>"), // Simple newlines to HTML
      text: message,
    });

    // Log the event to Firestore
    await adminDb.collection("admin").doc("emailLog").collection("entries").add({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      to,
      subject,
      message,
      messageId: info.messageId,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error sending email:", error);
    return NextResponse.json({ error: (error as Error).message || "Internal Server Error" }, { status: 500 });
  }
}
