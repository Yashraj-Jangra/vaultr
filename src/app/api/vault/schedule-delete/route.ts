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
          subject: "🚨 Action Required: Vault Deletion Scheduled — Vaultr",
          html: WRAPPER(`
            <div style="display:inline-block;padding:4px 10px;background-color:rgba(239,68,68,0.1);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:6px;margin-bottom:14px;">
              <span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.04em;text-transform:uppercase;">🚨 Action Required</span>
            </div>
            <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Vault Deletion Scheduled</h2>
            <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
              A request was initiated to permanently purge all data in your Vaultr vault.
            </p>
            <div style="background-color:#131317;background:#131317;border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:20px 22px;margin-bottom:26px;">
              <p style="margin:0 0 8px;font-size:13px;color:#ffffff;font-weight:600;">
                ⚠️ Scheduled Deletion Timestamp:
              </p>
              <p style="margin:0;font-size:13px;color:#ef4444;font-family:ui-monospace,monospace;font-weight:700;">
                ${scheduledDeleteAt.toUTCString()} (in 24 hours)
              </p>
            </div>
            <p style="font-size:13px;color:#71717a;margin-bottom:20px;line-height:1.6;">
              If you did not request this deletion, cancel the request immediately using the button below or navigate to <strong style="color:#ffffff;">Settings &rarr; Data</strong>.
            </p>
            <p style="margin:0 0 24px;">
              <a href="${cancelUrl}" style="display:inline-block;padding:11px 22px;background-color:#ef4444;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Cancel Deletion Immediately</a>
            </p>`, "DELETION SCHEDULED"),
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
