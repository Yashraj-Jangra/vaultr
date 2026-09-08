export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { verifyOtp } from "@/lib/linkOtpStore";
import { auth } from "@/lib/auth/auth";
import { safeError } from "@/lib/safeError";
import { rateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT_OPTIONS = {
  limit: 5,
  windowMs: 10 * 60 * 1000, // 5 attempts per 10 minutes
};

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    const clientIp = getClientIp(req);
    const rlKey = `link_password_verify:${user.id}:${clientIp}`;
    const rl = rateLimit(rlKey, RATE_LIMIT_OPTIONS);
    const headers = getRateLimitHeaders(rl);

    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait before trying again." },
        { status: 429, headers }
      );
    }

    const { otp, password } = await req.json();

    if (!otp) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400, headers });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400, headers });
    }

    const isValid = await verifyOtp(user.id, otp);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400, headers });
    }

    // Call Better Auth to assign/link a password to this account
    await auth.api.setPassword({
      body: {
        newPassword: password,
      },
      headers: req.headers,
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[verify POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
