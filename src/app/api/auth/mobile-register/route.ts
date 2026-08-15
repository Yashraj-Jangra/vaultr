import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const baseUrl = req.nextUrl.origin;

    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": req.headers.get("user-agent") || "VaultrMobile/1.0",
        "Origin": req.headers.get("origin") || baseUrl,
        "Referer": req.headers.get("referer") || `${baseUrl}/`,
      },
      body: bodyText,
    });

    const setCookieArray = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
    const setCookie = setCookieArray.find(c => c?.includes("better-auth.session_token"));
    let token = "";
    if (setCookie) {
      const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) token = match[1];
    }

    const data = await res.json();
    return NextResponse.json({ ...data, token }, { status: res.status });
  } catch (err: any) {
    console.error("[mobile-register]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
