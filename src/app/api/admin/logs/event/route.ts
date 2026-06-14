import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { auditLog, AuditEventKey } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req);
    const body = await req.json();

    const { event, meta } = body as { event: AuditEventKey; meta: any };

    if (!event) {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    auditLog({
      event,
      uid: admin.id,
      email: admin.email || "",
      ip: req.headers.get("x-forwarded-for") || undefined,
      meta: meta || {}
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(`[admin/logs/event POST]`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
