export const runtime = "nodejs";

/**
 * /api/admin/storage
 *
 * GET — aggregate storage stats for the admin dashboard.
 *       Returns total usage, bucket breakdown, and top users by storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";

import { db } from "@/db";
import { vaultAttachments, userProfiles, user } from "@/db/schema";
import { eq, sql, sum, count, desc } from "drizzle-orm";
import { s3 } from "@/lib/storage";
import { HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const ATTACHMENTS_BUCKET = process.env.MINIO_BUCKET_ATTACHMENTS ?? "attachments";
const AVATAR_BUCKET      = process.env.MINIO_BUCKET_AVATARS     ?? "avatars";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    // ── Per-user storage stats from DB ────────────────────────────────────────
    const userStats = await db
      .select({
        userId:     vaultAttachments.userId,
        usedBytes:  sum(vaultAttachments.sizeBytes),
        fileCount:  count(vaultAttachments.id),
      })
      .from(vaultAttachments)
      .groupBy(vaultAttachments.userId)
      .orderBy(desc(sum(vaultAttachments.sizeBytes)))
      .limit(50);

    // ── Enrich with user info + quota ─────────────────────────────────────────
    const topUsers = await Promise.all(
      userStats.map(async (row) => {
        const [u] = await db
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, row.userId))
          .limit(1);

        const [p] = await db
          .select({ quotaBytes: userProfiles.storageQuotaBytes })
          .from(userProfiles)
          .where(eq(userProfiles.userId, row.userId))
          .limit(1);

        return {
          userId:     row.userId,
          name:       u?.name  ?? "Unknown",
          email:      u?.email ?? "Unknown",
          usedBytes:  Number(row.usedBytes  ?? 0),
          quotaBytes: Number(p?.quotaBytes  ?? 104_857_600),
          fileCount:  Number(row.fileCount  ?? 0),
        };
      })
    );

    // ── Totals ────────────────────────────────────────────────────────────────
    const [totals] = await db
      .select({
        totalUsedBytes: sum(vaultAttachments.sizeBytes),
        totalFiles:     count(vaultAttachments.id),
      })
      .from(vaultAttachments);

    // ── Users over quota ──────────────────────────────────────────────────────
    const usersOverQuota = topUsers.filter((u) => u.usedBytes >= u.quotaBytes).length;

    // ── Avatar bucket size (best-effort, walk objects) ────────────────────────
    let avatarUsedBytes = 0;
    let avatarFileCount = 0;
    try {
      const listed = await s3.send(
        new ListObjectsV2Command({ Bucket: AVATAR_BUCKET })
      );
      avatarFileCount = listed.Contents?.length ?? 0;
      avatarUsedBytes = (listed.Contents ?? []).reduce((sum, obj) => sum + (obj.Size ?? 0), 0);
    } catch {
      // Bucket might not exist yet in dev
    }

    return NextResponse.json({
      totalUsedBytes:  Number(totals.totalUsedBytes ?? 0),
      totalFiles:      Number(totals.totalFiles     ?? 0),
      totalUsers:      topUsers.length,
      usersOverQuota,
      buckets: {
        attachments: {
          usedBytes:  Number(totals.totalUsedBytes ?? 0),
          fileCount:  Number(totals.totalFiles     ?? 0),
        },
        avatars: {
          usedBytes:  avatarUsedBytes,
          fileCount:  avatarFileCount,
        },
      },
      topUsers,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/admin/storage]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
