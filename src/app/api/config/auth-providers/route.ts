export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * GET /api/config/auth-providers
 * Public discovery endpoint for mobile and native clients.
 * Informs clients which social auth providers are enabled and provides their public Client IDs.
 */
export async function GET() {
  const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const googleIosClientId = (process.env.GOOGLE_IOS_CLIENT_ID || "").trim();
  const googleAndroidClientId = (process.env.GOOGLE_ANDROID_CLIENT_ID || "").trim();
  const googleEnabled = Boolean(googleClientId || googleIosClientId || googleAndroidClientId);

  return NextResponse.json({
    googleEnabled,
    googleClientId: googleClientId || undefined,
    googleIosClientId: googleIosClientId || undefined,
    googleAndroidClientId: googleAndroidClientId || undefined,
  });
}
