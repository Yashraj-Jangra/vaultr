export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { generateAndStoreOtp } from "@/lib/linkOtpStore";
import { sendTemplatedEmail } from "@/lib/emailTemplates";
import { safeError } from "@/lib/safeError";
import { rateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT_OPTIONS = {
  limit: 3,
  windowMs: 10 * 60 * 1000, // 3 requests per 10 minutes
};

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    if (!user.email) {
      return NextResponse.json({ error: "Session has no email address associated" }, { status: 400 });
    }

    // Rate limit by userId and client IP
    const clientIp = getClientIp(req);
    const rlKey = `link_password_send_otp:${user.id}:${clientIp}`;
    const rl = rateLimit(rlKey, RATE_LIMIT_OPTIONS);
    const headers = getRateLimitHeaders(rl);

    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait a few minutes before trying again." },
        { status: 429, headers }
      );
    }

    const otp = await generateAndStoreOtp(user.id);

    // Send the OTP using the device_verification template, styled as linking request
    await sendTemplatedEmail({
      templateKey: "device_verification",
      to: user.email,
      vars: {
        OTP: otp,
        DEVICE_NAME: "Password Link Verification",
      },
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[send-otp POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
