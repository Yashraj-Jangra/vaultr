export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTransporter } from "@/lib/emailTemplates";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const [profile] = await db
      .select({ scheduledDeleteAt: userProfiles.scheduledDeleteAt })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id));

    return NextResponse.json({
      scheduledDeleteAt: profile?.scheduledDeleteAt ? profile.scheduledDeleteAt.toISOString() : null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[schedule-delete GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    if (body.confirm !== "DELETE") {
      return NextResponse.json({ error: 'Confirmation string "DELETE" required' }, { status: 400 });
    }

    const scheduledDeleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        scheduledDeleteAt,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { scheduledDeleteAt },
      });

    // Send warning email if SMTP is configured
    try {
      const conn = await createTransporter();
      if (conn && user.email) {
        await conn.transporter.sendMail({
          from: conn.fromAddress,
          to: user.email,
          subject: "🚨 Action Required: Vault Deletion Scheduled - Vaultr",
          html: `<div style="background:#0a0a0a;color:#eee;padding:24px;font-family:sans-serif;border-radius:12px;">
            <h2 style="color:#ef4444;margin-top:0;">Vault Deletion Scheduled</h2>
            <p>A request was made to delete all data in your Vaultr vault.</p>
            <p>Your vault data is scheduled to be <strong>permanently deleted in 24 hours</strong> (${scheduledDeleteAt.toUTCString()}).</p>
            <p>If you did not request this, please sign in to Vaultr immediately and cancel the deletion request from Settings &rarr; Data.</p>
            <hr style="border-color:#333;margin:20px 0;"/>
            <p style="font-size:12px;color:#888;">Vaultr Zero-Knowledge Vault Security</p>
          </div>`,
          text: `Vault Deletion Scheduled.\n\nAll data in your Vaultr vault is scheduled for permanent deletion in 24 hours (${scheduledDeleteAt.toUTCString()}).\n\nIf you did not request this, please sign in immediately and cancel the deletion from Settings -> Data.`,
        });
      }
    } catch (emailErr) {
      console.error("[schedule-delete POST] Failed to send email alert:", emailErr);
    }

    return NextResponse.json({
      success: true,
      scheduledDeleteAt: scheduledDeleteAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[schedule-delete POST]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    await db
      .update(userProfiles)
      .set({ scheduledDeleteAt: null })
      .where(eq(userProfiles.userId, user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[schedule-delete DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
