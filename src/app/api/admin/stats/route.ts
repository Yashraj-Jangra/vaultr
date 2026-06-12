export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { configStats, userProfiles } from "@/db/schema";
import { count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    // 1. Get user count
    const userCountResult = await db.select({ value: count() }).from(userProfiles);
    const totalUsers = userCountResult[0]?.value ?? 0;

    // 2. Get entry count from stats singleton
    const statsResult = await db.select().from(configStats).limit(1);
    const totalEntries = statsResult[0]?.totalEntries ?? 0;

    return NextResponse.json({
      totalUsers,
      totalEntries,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/stats GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
