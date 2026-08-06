export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { generateAndStoreOtp } from "@/lib/linkOtpStore";
import { sendTemplatedEmail } from "@/lib/emailTemplates";
import { safeError } from "@/lib/safeError";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    if (!user.email) {
      return NextResponse.json({ error: "Session has no email address associated" }, { status: 400 });
    }

    const otp = generateAndStoreOtp(user.id);

    // Send the OTP using the device_verification template, styled as linking request
    await sendTemplatedEmail({
      templateKey: "device_verification",
      to: user.email,
      vars: {
        OTP: otp,
        DEVICE_NAME: "Password Link Verification",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[send-otp POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
