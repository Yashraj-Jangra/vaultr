import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";
import { auth } from "@/lib/auth/auth";
import { APIError } from "better-auth/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await auth.api.signInEmail({
      body,
      headers: req.headers,
    });
    const responseUser: typeof data.user & { avatarUrl?: string | null } = {
      ...data.user,
    };

    // Enrich with user profile avatar if available
    if (data.user.id) {
      const [profile] = await db
        .select({ avatarUrl: userProfiles.avatarUrl, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, data.user.id))
        .limit(1);

      if (profile?.avatarUrl) {
        const publicAvatar = toPublicUrl(profile.avatarUrl);
        if (publicAvatar) {
          responseUser.image = publicAvatar;
          responseUser.avatarUrl = publicAvatar;
        }
      }
      if (profile?.displayName) {
        responseUser.name = profile.displayName;
      }
    }

    return NextResponse.json({ ...data, user: responseUser });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json(
        {
          error: err.body?.message ?? err.message,
          ...(err.body?.code ? { code: err.body.code } : {}),
        },
        { status: err.statusCode }
      );
    }
    console.error("[mobile-login]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
