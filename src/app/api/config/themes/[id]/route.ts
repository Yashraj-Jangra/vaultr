export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { configThemes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { id } = await params;
    const body = await req.json();

    const [row] = await db
      .select()
      .from(configThemes)
      .where(eq(configThemes.id, id))
      .limit(1);

    if (!row)
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });

    await db
      .update(configThemes)
      .set({ published: body.published ?? row.published })
      .where(eq(configThemes.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/config/themes/[id]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { id } = await params;
    await db.delete(configThemes).where(eq(configThemes.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/config/themes/[id]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
