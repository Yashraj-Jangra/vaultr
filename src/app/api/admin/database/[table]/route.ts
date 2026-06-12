export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

// Map URL slugs to actual Drizzle table objects
const tableMap: Record<string, any> = {
  "vault_items": schema.vaultItems,
  "user_profiles": schema.userProfiles,
  "audit_logs": schema.auditLogs,
  "support_tickets": schema.supportTickets,
  "ticket_messages": schema.ticketMessages,
  "email_logs": schema.emailLogs,
  "config_system": schema.configSystem,
  "user": schema.user,
  "session": schema.session,
  "account": schema.account,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { table } = await params;

    const dbTable = tableMap[table];
    if (!dbTable) {
      return NextResponse.json({ error: "Table not found or not exposed" }, { status: 404 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Dynamic query using drizzle
    // Due to dynamic typing, we use SQL count for total and raw select for data
    
    // To get a quick count:
    const countRes = await db.execute(sql`SELECT COUNT(*) as count FROM ${dbTable}`);
    const total = Number((countRes as any).rows?.[0]?.count ?? 0);

    // To get the rows:
    const rows = await db.select().from(dbTable).limit(limit).offset(offset);

    return NextResponse.json({ rows, total });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(`[admin/database GET]`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
