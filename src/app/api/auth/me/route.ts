/**
 * src/app/api/auth/me/route.ts
 *
 * Returns the current user's profile from user_profiles table,
 * including their role (admin/user) and other preferences.
 *
 * Called by useAuth hook to check admin status.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    // Get or create profile row
    let [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    // Auto-create profile on first login
    if (!profile) {
      [profile] = await db
        .insert(userProfiles)
        .values({
          userId:      user.id,
          displayName: user.name ?? null,
          role:        "user",
        })
        .returning();
    }

    return NextResponse.json({
      id:          user.id,
      email:       user.email,
      displayName: profile.displayName,
      avatarUrl:   toPublicUrl(profile.avatarUrl),
      role:        profile.role,
      disabled:    profile.disabled,
      storageUsedBytes: profile.storageUsedBytes ?? 0,
      storageQuotaBytes: profile.storageQuotaBytes ?? 104_857_600,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[/api/auth/me]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
