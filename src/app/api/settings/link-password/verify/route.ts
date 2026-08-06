export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { verifyOtp } from "@/lib/linkOtpStore";
import { auth } from "@/lib/auth/auth";
import { safeError } from "@/lib/safeError";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const { otp, password } = await req.json();

    if (!otp) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const isValid = verifyOtp(user.id, otp);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    // Call Better Auth to assign/link a password to this account
    await auth.api.setPassword({
      body: {
        newPassword: password,
      },
      headers: req.headers,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[verify POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
