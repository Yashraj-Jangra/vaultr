export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { userProfiles, vaultAttachments, vaultItems } from "@/db/schema";
import { eq, and, isNull, sql, sum } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    // Compute live total size of user's vault attachments from vaultAttachments table
    const [attStats] = await db
      .select({
        totalAttachmentBytes: sum(vaultAttachments.sizeBytes),
      })
      .from(vaultAttachments)
      .where(eq(vaultAttachments.userId, user.id));

    // Compute live total size of user's active vault items from vaultItems table
    const [itemStats] = await db
      .select({
        totalItemBytes: sql<number>`coalesce(sum(length(${vaultItems.encryptedBlob})), 0)`,
      })
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, user.id), isNull(vaultItems.deletedAt)));

    const liveUsedBytes =
      Number(attStats?.totalAttachmentBytes ?? 0) +
      Number(itemStats?.totalItemBytes ?? 0);

    const quotaBytes = profile?.storageQuotaBytes ?? 104_857_600; // 100 MB default

    // Background sync userProfiles.storageUsedBytes if it differed
    if (profile && profile.storageUsedBytes !== liveUsedBytes) {
      db.update(userProfiles)
        .set({ storageUsedBytes: liveUsedBytes })
        .where(eq(userProfiles.userId, user.id))
        .catch(() => {});
    }

    return NextResponse.json({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.phone ?? "",
      displayName: profile?.displayName ?? "",
      avatarUrl: toPublicUrl(profile?.avatarUrl) ?? "",
      lastPasswordChangedAt: profile?.lastPasswordChangedAt ? profile.lastPasswordChangedAt.toISOString() : null,
      newDeviceEmailAlert: profile?.newDeviceEmailAlert ?? true,
      requireVerificationOnNew: profile?.requireVerificationOnNew ?? false,
      clipboardClearSeconds: profile?.clipboardClearSeconds ?? 0,
      autoLockMinutes: profile?.autoLockMinutes ?? 15,
      disabled: profile?.disabled ?? false,
      role: profile?.role ?? "user",
      storageUsedBytes: liveUsedBytes,
      storageQuotaBytes: quotaBytes,
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
