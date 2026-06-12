export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { configThemes } from "@/db/schema";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";

export async function GET() {
  try {
    const themes = await db.select().from(configThemes);
    return NextResponse.json({ themes });
  } catch (err) {
    console.error("[GET /api/config/themes]", err);
    return NextResponse.json({ themes: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const { theme } = await req.json();
    await db
      .insert(configThemes)
      .values({
        id:        theme.id,
        data:      theme,
        published: theme.published ?? false,
        builtIn:   theme.builtIn  ?? false,
      })
      .onConflictDoUpdate({
        target: configThemes.id,
        set: { data: theme, published: theme.published, builtIn: theme.builtIn },
      });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/config/themes]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
