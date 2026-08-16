import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const provider = req.nextUrl.searchParams.get("provider") || "google";
    const rawAppUrl = req.nextUrl.searchParams.get("appUrl") || "vaultr://auth-callback";

    // Determine clean base URL from request / reverse proxy headers
    const forwardedProto =
      req.headers.get("x-forwarded-proto") ||
      (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "http");
    const forwardedHost =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.host ||
      "localhost:3000";

    const baseUrl = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
    const callbackURL = `${baseUrl}/api/auth/mobile-callback?appUrl=${encodeURIComponent(rawAppUrl)}`;

    // Call Better Auth social sign-in inside the browser context
    // This ensures state cookies (better-auth.state, better-auth.pkce_code_verifier)
    // are set directly on the browser session, preventing state_mismatch errors.
    const authRes = await auth.api.signInSocial({
      body: {
        provider: provider as "google",
        callbackURL,
      },
      headers: req.headers,
      asResponse: true,
    });

    if (!authRes) {
      return new NextResponse("Failed to initiate OAuth provider.", { status: 500 });
    }

    // If Better Auth returned a direct redirect response
    if (authRes.status >= 300 && authRes.status < 400) {
      return authRes;
    }

    // If Better Auth returned a JSON payload with { url, redirect: true }
    try {
      const cloned = authRes.clone();
      const data = await cloned.json();
      if (data?.url) {
        const redirectRes = NextResponse.redirect(data.url, { status: 302 });
        // Preserve all Set-Cookie headers from Better Auth
        authRes.headers.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie") {
            redirectRes.headers.append("set-cookie", value);
          }
        });
        return redirectRes;
      }
    } catch {
      // Not JSON, return original response
    }

    return authRes;
  } catch (err: any) {
    console.error("[GET /api/auth/mobile-start] Error:", err);
    return new NextResponse(
      `<!DOCTYPE html><html><body style="background:#09090b;color:#f87171;font-family:sans-serif;text-align:center;padding-top:50px;"><h2>OAuth Start Failed</h2><p>${err?.message || "Failed to initialize social login."}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
