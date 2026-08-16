import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { session as sessionTable, user as userTable, userProfiles } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    let token = "";
    let userId = "";
    let email = "";
    let name = "";
    let avatarUrl = "";

    // 1. Try resolving session via Better Auth API
    try {
      const sessionResult = await auth.api.getSession({
        headers: req.headers,
      });
      if (sessionResult?.session && sessionResult?.user) {
        token = sessionResult.session.token || sessionResult.session.id;
        userId = sessionResult.user.id;
        email = sessionResult.user.email || "";
        name = sessionResult.user.name || "";
        avatarUrl = sessionResult.user.image || "";
      }
    } catch (e) {
      console.warn("[mobile-callback] getSession header check failed, trying cookie fallback:", e);
    }

    // 2. Resilient Fallback: check session token directly from cookies / DB
    if (!token || !userId) {
      const cookieToken =
        req.cookies.get("better-auth.session_token")?.value ||
        req.cookies.get("__Secure-better-auth.session_token")?.value ||
        req.nextUrl.searchParams.get("token") ||
        "";

      if (cookieToken) {
        const [dbSession] = await db
          .select()
          .from(sessionTable)
          .where(
            and(
              eq(sessionTable.token, cookieToken),
              gt(sessionTable.expiresAt, new Date())
            )
          )
          .limit(1);

        if (dbSession) {
          token = dbSession.token;
          userId = dbSession.userId;
          const [dbUser] = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, userId))
            .limit(1);

          if (dbUser) {
            email = dbUser.email || "";
            name = dbUser.name || "";
            if (dbUser.image) avatarUrl = dbUser.image;
          }
        }
      }
    }

    if (!token || !userId) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vaultr Authentication</title>
  <style>
    body { background: #09090b; color: #f87171; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #111111; border: 1px solid #1f1f1f; border-radius: 16px; padding: 32px 24px; max-width: 340px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h2 { font-size: 18px; margin: 0 0 8px; color: #f87171; }
    p { font-size: 13px; color: #a1a1aa; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Authentication Failed</h2>
    <p>No valid session token was found. Please return to the app and try signing in again.</p>
  </div>
</body>
</html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 401 }
      );
    }

    // 3. Enrich with userProfiles avatar / displayName
    try {
      const [profile] = await db
        .select({ avatarUrl: userProfiles.avatarUrl, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (profile?.avatarUrl) {
        avatarUrl = toPublicUrl(profile.avatarUrl) || profile.avatarUrl;
      }
      if (profile?.displayName) {
        name = profile.displayName;
      }
    } catch { }

    const rawAppUrl = req.nextUrl.searchParams.get("appUrl") || "vaultr://auth-callback";
    const isValidAppUrl =
      rawAppUrl.startsWith("vaultr://") ||
      rawAppUrl.startsWith("vaultr:///") ||
      rawAppUrl.startsWith("exp://");
    const appUrl = isValidAppUrl ? rawAppUrl : "vaultr://auth-callback";

    const joiner = appUrl.includes("?") ? "&" : "?";
    const deepLink = `${appUrl}${joiner}token=${encodeURIComponent(token)}&id=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&image=${encodeURIComponent(avatarUrl)}&avatarUrl=${encodeURIComponent(avatarUrl)}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vaultr Mobile Authentication</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #111111; border: 1px solid #1f1f1f; border-radius: 16px; padding: 32px 24px; max-width: 340px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h1 { font-size: 18px; margin: 12px 0 6px; color: #f4f4f5; }
    p { font-size: 13px; color: #a1a1aa; margin-bottom: 24px; }
    .btn { display: inline-block; background: #f4f4f5; color: #09090b; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 24px; border-radius: 12px; transition: opacity 0.2s; }
    .btn:active { opacity: 0.8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authenticated Successfully</h1>
    <p>Redirecting back to Vaultr app…</p>
    <a href="${deepLink}" class="btn" id="openBtn">Open Vaultr App</a>
  </div>
  <script>
    (function() {
      var target = "${deepLink}";
      try {
        window.location.replace(target);
      } catch (e) {
        window.location.href = target;
      }
      setTimeout(function() {
        var btn = document.getElementById("openBtn");
        if (btn) btn.click();
      }, 300);
    })();
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[GET /api/auth/mobile-callback]", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}
