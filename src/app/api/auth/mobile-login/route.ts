import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const baseUrl = req.nextUrl.origin; // e.g. http://localhost:3000

    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
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

    // Enrich with user profile avatar if available
    if (res.ok && data?.user?.id) {
      const [profile] = await db
        .select({ avatarUrl: userProfiles.avatarUrl, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, data.user.id))
        .limit(1);

      if (profile?.avatarUrl) {
        const publicAvatar = toPublicUrl(profile.avatarUrl);
        if (publicAvatar) {
          data.user.image = publicAvatar;
          data.user.avatarUrl = publicAvatar;
        }
      }
      if (profile?.displayName) {
        data.user.name = profile.displayName;
      }
    }

    return NextResponse.json({ ...data, token }, { status: res.status });
  } catch (err: any) {
    console.error("[mobile-login]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
