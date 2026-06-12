export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { adminSmtp } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const [row] = await db
      .select({ data: adminSmtp.data })
      .from(adminSmtp)
      .where(eq(adminSmtp.id, 1))
      .limit(1);

    return NextResponse.json({ smtp: row?.data ?? null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/smtp GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();

    await db
      .insert(adminSmtp)
      .values({ id: 1, data: body })
      .onConflictDoUpdate({
        target: adminSmtp.id,
        set: { data: body },
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/smtp POST]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
