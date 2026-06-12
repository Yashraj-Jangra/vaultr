export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { adminEmailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const [row] = await db
      .select({ data: adminEmailTemplates.data })
      .from(adminEmailTemplates)
      .where(eq(adminEmailTemplates.id, 1))
      .limit(1);

    return NextResponse.json({ templates: row?.data ?? {} });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/email/templates GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();

    await db
      .insert(adminEmailTemplates)
      .values({ id: 1, data: body })
      .onConflictDoUpdate({
        target: adminEmailTemplates.id,
        set: { data: body },
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/email/templates POST]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
