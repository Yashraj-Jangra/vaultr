export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTransporter, WRAPPER, getBrandLogoAttachment } from "@/lib/emailTemplates";
import { rateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT_OPTIONS = {
  limit: 3,
  windowMs: 10 * 60 * 1000, // 3 requests per 10 minutes
};

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

    const clientIp = getClientIp(req);
    const rlKey = `schedule_delete_post:${user.id}:${clientIp}`;
    const rl = rateLimit(rlKey, RATE_LIMIT_OPTIONS);
    const headers = getRateLimitHeaders(rl);

    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many schedule deletion requests. Please wait." },
        { status: 429, headers }
      );
    }

    const body = await req.json();

    if (body.confirm !== "DELETE") {
      return NextResponse.json({ error: 'Confirmation string "DELETE" required' }, { status: 400, headers });
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
        const cancelUrl = `${appUrl}/settings?tab=data`;

        await conn.transporter.sendMail({
          from: conn.fromAddress,
          to: user.email,
          subject: "Vault deletion scheduled",
          html: WRAPPER(`
            <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Vault deletion scheduled</h2>
            <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
              A request was received to permanently delete all data in your Vaultr account.
            </p>
            <div style="background-color:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
              <p style="margin:0 0 6px;font-size:13px;color:#991b1b;font-weight:600;">
                Scheduled deletion date:
              </p>
              <p style="margin:0;font-size:13px;color:#dc2626;font-family:ui-monospace,monospace;font-weight:600;">
                ${scheduledDeleteAt.toUTCString()} (in 24 hours)
              </p>
            </div>
            <p style="font-size:13px;color:#6b7280;margin:0 0 20px;line-height:1.6;">
              If you did not request this deletion, cancel the request immediately using the button below or sign in to your vault.
            </p>
            <p style="margin:0;">
              <a href="${cancelUrl}" style="display:inline-block;padding:11px 22px;background-color:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:500;">Cancel Deletion Immediately</a>
            </p>`, "Action Required"),
          text: `Vault Deletion Scheduled.\n\nAll data in your Vaultr vault is scheduled for permanent deletion in 24 hours (${scheduledDeleteAt.toUTCString()}).\n\nIf you did not request this, please sign in immediately and cancel the deletion from Settings -> Data: ${cancelUrl}`,
          attachments: getBrandLogoAttachment(),
        });
      }
    } catch (emailErr) {
      console.error("[schedule-delete POST] Failed to send email alert:", emailErr);
    }

    return NextResponse.json({
      success: true,
      scheduledDeleteAt: scheduledDeleteAt.toISOString(),
    }, { headers });
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
