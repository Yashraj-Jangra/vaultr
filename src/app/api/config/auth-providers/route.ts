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
  const googleEnabled = googleClientId.length > 0;

  return NextResponse.json({
    googleEnabled,
    googleClientId: googleEnabled ? googleClientId : undefined,
  });
}
