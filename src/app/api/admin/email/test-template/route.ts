export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { sendTemplatedEmail, DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/emailTemplates";

// Representative placeholder values per template key for test sends
const TEST_VARS: Record<string, Record<string, string>> = {
  device_verification: {
    OTP: "847291",
    DEVICE_NAME: "Chrome on Windows 11",
  },
  new_device_alert: {
    DEVICE_NAME: "Firefox on macOS",
    LOCATION: "London, United Kingdom",
    TIME: new Date().toUTCString(),
    SECURITY_URL: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://vaultr.app"}/settings/security`,
  },
  welcome: {
    USER_NAME: "Alex",
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "https://vaultr.app",
  },
  password_changed: {
    DATE: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    ITEM_COUNT: "42",
    SECURITY_URL: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://vaultr.app"}/settings/security`,
  },
  account_deleted: {},
};

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const { templateKey, to } = await req.json();

    if (!templateKey || !to)
      return NextResponse.json({ error: "templateKey and to are required" }, { status: 400 });

    if (!Object.keys(DEFAULT_TEMPLATES).includes(templateKey))
      return NextResponse.json({ error: "Unknown template key" }, { status: 400 });

    const vars = TEST_VARS[templateKey] ?? {};

    // sendTemplatedEmail no longer takes a db param — it imports db directly
    await sendTemplatedEmail({ templateKey: templateKey as TemplateKey, to, vars });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : "Failed to send test email";
    console.error("[test-template]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
