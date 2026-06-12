export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    return NextResponse.json({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.phone ?? "",
      displayName: profile?.displayName ?? "",
      avatarUrl: profile?.avatarUrl ?? "",
      lastPasswordChangedAt: profile?.lastPasswordChangedAt ? profile.lastPasswordChangedAt.toISOString() : null,
      newDeviceEmailAlert: profile?.newDeviceEmailAlert ?? true,
      requireVerificationOnNew: profile?.requireVerificationOnNew ?? false,
      clipboardClearSeconds: profile?.clipboardClearSeconds ?? 0,
      autoLockMinutes: profile?.autoLockMinutes ?? 15,
      disabled: profile?.disabled ?? false,
      role: profile?.role ?? "user",
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/profile]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();
    const {
      firstName,
      lastName,
      phone,
      displayName,
      avatarUrl,
      lastPasswordChangedAt,
      newDeviceEmailAlert,
      requireVerificationOnNew,
      clipboardClearSeconds,
      autoLockMinutes,
    } = body;

    const insertValues = {
      userId: user.id,
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(displayName !== undefined && { displayName }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(lastPasswordChangedAt !== undefined && { lastPasswordChangedAt: lastPasswordChangedAt ? new Date(lastPasswordChangedAt) : null }),
      ...(newDeviceEmailAlert !== undefined && { newDeviceEmailAlert }),
      ...(requireVerificationOnNew !== undefined && { requireVerificationOnNew }),
      ...(clipboardClearSeconds !== undefined && { clipboardClearSeconds }),
      ...(autoLockMinutes !== undefined && { autoLockMinutes }),
    };

    const setValues = {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(displayName !== undefined && { displayName }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(lastPasswordChangedAt !== undefined && { lastPasswordChangedAt: lastPasswordChangedAt ? new Date(lastPasswordChangedAt) : null }),
      ...(newDeviceEmailAlert !== undefined && { newDeviceEmailAlert }),
      ...(requireVerificationOnNew !== undefined && { requireVerificationOnNew }),
      ...(clipboardClearSeconds !== undefined && { clipboardClearSeconds }),
      ...(autoLockMinutes !== undefined && { autoLockMinutes }),
    };

    const [updated] = await db
      .insert(userProfiles)
      .values(insertValues)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: setValues,
      })
      .returning();

    return NextResponse.json({ success: true, profile: updated });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/profile]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
