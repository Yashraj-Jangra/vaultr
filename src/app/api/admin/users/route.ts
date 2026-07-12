export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";

// Hard cap on results per request
const MAX_RESULTS = 200;
const DEFAULT_RESULTS = 50;

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const url = new URL(req.url);
    const rawLimit  = parseInt(url.searchParams.get("maxResults") ?? String(DEFAULT_RESULTS), 10);
    const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Enforce upper bound to prevent full-table dumps
    const limit  = Math.min(isNaN(rawLimit)  ? DEFAULT_RESULTS : rawLimit,  MAX_RESULTS);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // Better Auth admin API — list users from auth tables with pagination
    const { users, total } = await auth.api.listUsers({
      headers: req.headers,
      query: { limit, offset },
    });

    // Fetch ONLY profiles for the current page of users (not the entire table)
    const userIds = users.map((u) => u.id);
    const profileRows =
      userIds.length > 0
        ? await db.select().from(userProfiles).where(
            // Drizzle inArray — matches all returned user IDs
            (() => {
              const { inArray } = require("drizzle-orm");
              return inArray(userProfiles.userId, userIds);
            })()
          )
        : [];

    const profileMap = Object.fromEntries(profileRows.map((p) => [p.userId, p]));

    const mapped = users.map((u) => ({
      uid:          u.id,
      email:        u.email,
      displayName:  u.name,
      creationTime: u.createdAt,
      lastSignInTime: null, // Better Auth does not expose this directly
      disabled:     profileMap[u.id]?.disabled ?? false,
      isAdmin:      profileMap[u.id]?.role === "admin",
    }));

    return NextResponse.json({ users: mapped, total });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/users GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
