import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionResult = await auth.api.getSession({
      headers: req.headers,
    });

    if (!sessionResult?.user || !sessionResult?.session) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="background:#09090b;color:#f87171;font-family:sans-serif;text-align:center;padding-top:50px;"><h2>Authentication failed</h2><p>No valid session found.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const token = sessionResult.session.token || sessionResult.session.id;
    const { id, email, name } = sessionResult.user;

    const deepLink = `vaultr://auth-callback?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}&email=${encodeURIComponent(email || "")}&name=${encodeURIComponent(name || "")}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vaultr Mobile Authentication</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #111111; border: 1px solid #1f1f1f; border-radius: 16px; padding: 32px 24px; max-width: 340px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h1 { font-size: 18px; margin: 12px 0 6px; }
    p { font-size: 13px; color: #a3a3a3; margin-bottom: 24px; }
    .btn { display: inline-block; background: #f4f4f5; color: #09090b; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authenticated!</h1>
    <p>Redirecting back to Vaultr app…</p>
    <a href="${deepLink}" class="btn">Open Vaultr App</a>
  </div>
  <script>
    setTimeout(function() { window.location.href = "${deepLink}"; }, 100);
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[GET /api/auth/mobile-callback]", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}
