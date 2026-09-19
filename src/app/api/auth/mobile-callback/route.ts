export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/mobile-callback
 *
 * Lightweight OAuth bounce callback for native mobile clients.
 * Google Cloud Console requires HTTPS redirect URIs for Web OAuth clients.
 * Google redirects here after user consent:
 *   /api/auth/mobile-callback?code=...&state=<app_return_url>
 *
 * This endpoint immediately redirects (302) back to the mobile app
 * (e.g. exp://... in Expo Go or vaultr:// in standalone builds),
 * allowing WebBrowser.openAuthSessionAsync to intercept the result.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code") || "";
    const idToken = searchParams.get("id_token") || "";
    const error = searchParams.get("error_description") || searchParams.get("error") || "";

    // The app's private deep link was passed in the OAuth state parameter
    const rawState = searchParams.get("state") || "";
    let appUrl = "vaultr://auth-callback";

    if (
      rawState &&
      (rawState.startsWith("exp://") ||
        rawState.startsWith("vaultr://") ||
        rawState.startsWith("http://localhost") ||
        rawState.startsWith("http://127.0.0.1"))
    ) {
      appUrl = rawState;
    }

    const joiner = appUrl.includes("?") ? "&" : "?";
    const redirectParams = new URLSearchParams();
    if (code) redirectParams.set("code", code);
    if (idToken) redirectParams.set("id_token", idToken);
    if (error) redirectParams.set("error", error);

    const target = `${appUrl}${joiner}${redirectParams.toString()}`;

    // Return both HTTP 302 and HTML meta refresh/script redirect
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${target}"><script>window.location.replace(${JSON.stringify(target)});</script></head><body style="background:#09090b;color:#a1a1aa;font-family:sans-serif;text-align:center;padding:40px;">Redirecting back to Vaultr app...</body></html>`,
      {
        status: 302,
        headers: {
          Location: target,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("[GET /api/auth/mobile-callback]", err);
    return new NextResponse("OAuth Callback Error", { status: 500 });
  }
}
