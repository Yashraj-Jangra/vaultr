export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { configSite } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";

export async function GET() {
  try {
    const [row] = await db.select().from(configSite).where(eq(configSite.id, 1)).limit(1);
    return NextResponse.json({ config: row?.data ?? {} });
  } catch (err) {
    console.error("[GET /api/config/site]", err);
    return NextResponse.json({ config: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const { config } = await req.json();
    await db
      .insert(configSite)
      .values({ id: 1, data: config })
      .onConflictDoUpdate({ target: configSite.id, set: { data: config } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/config/site]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
