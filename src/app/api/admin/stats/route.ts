export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { configStats, userProfiles } from "@/db/schema";
import { count } from "drizzle-orm";
import { s3, AVATAR_BUCKET } from "@/lib/storage";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    // 1. Measure DB ping & user count
    const dbStart = performance.now();
    const userCountResult = await db.select({ value: count() }).from(userProfiles);
    const dbLatency = Math.round(performance.now() - dbStart);
    const totalUsers = userCountResult[0]?.value ?? 0;

    // 2. Get entry count from stats singleton
    const statsResult = await db.select().from(configStats).limit(1);
    const totalEntries = statsResult[0]?.totalEntries ?? 0;

    // 3. Measure S3 Storage ping & availability
    let storageStatus = "Connected";
    let storageLatency = 0;
    try {
      const s3Start = performance.now();
      await s3.send(new HeadBucketCommand({ Bucket: AVATAR_BUCKET }));
      storageLatency = Math.round(performance.now() - s3Start);
    } catch (err) {
      storageStatus = "Disconnected";
      // Fallback: If s3 is not responsive or bucket is missing
      console.warn("[admin/stats storage check failure]", err);
    }

    // 4. Resolve local server node region/location
    const nodeLocation = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    return NextResponse.json({
      totalUsers,
      totalEntries,
      dbStatus: "Connected",
      dbLatency,
      storageStatus,
      storageLatency,
      nodeLocation,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/stats GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
