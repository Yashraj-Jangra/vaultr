import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    
    // Fetch user profile from DB to get avatarUrl, displayName, and storage quota
    const [profile] = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        displayName: userProfiles.displayName,
        storageUsedBytes: userProfiles.storageUsedBytes,
        storageQuotaBytes: userProfiles.storageQuotaBytes,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    // Fetch the full session to retrieve the user's image URL fallback
    const sessionResult = await auth.api.getSession({
      headers: req.headers,
    });
    
    const rawImage = profile?.avatarUrl || sessionResult?.user?.image || null;
    const image = toPublicUrl(rawImage) || rawImage;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: profile?.displayName || user.name,
      displayName: profile?.displayName || user.name,
      image,
      avatarUrl: image,
      storageUsedBytes: profile?.storageUsedBytes ?? 0,
      storageQuotaBytes: profile?.storageQuotaBytes ?? 104_857_600,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/me]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
