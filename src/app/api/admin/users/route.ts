export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const url = new URL(req.url);
    const limit  = parseInt(url.searchParams.get("maxResults") ?? "100", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Better Auth admin API — list all users from auth tables
    const { users, total } = await auth.api.listUsers({
      query: { limit, offset },
    });

    // Fetch profiles in bulk for role/disabled status
    const profileRows = await db.select().from(userProfiles);
    const profileMap = Object.fromEntries(profileRows.map((p) => [p.userId, p]));

    const mapped = users.map((u) => ({
      uid:          u.id,
      email:        u.email,
      displayName:  u.name,
      creationTime: u.createdAt,
      lastSignInTime: null,           // Better Auth does not expose this directly
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
