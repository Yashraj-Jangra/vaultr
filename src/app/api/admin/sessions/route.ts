export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { getAllSessions } from "@/lib/sessionMeta";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

/**
 * GET /api/admin/sessions
 * Returns all active sessions across all users (admin only).
 * Supports ?limit=&offset=&search= query params.
 */
export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const url    = new URL(req.url);
    const limit  = Math.min(
      parseInt(url.searchParams.get("limit")  ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
    const search = url.searchParams.get("search")?.trim() || undefined;

    const result = await getAllSessions({ limit, offset, search });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/sessions GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
