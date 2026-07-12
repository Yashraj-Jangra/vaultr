export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { auditLog } from "@/lib/auditLog";
import { getClientIp } from "@/lib/getClientIp";

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

function getPrimaryKeyCol(dbTable: any) {
  // Try to find the primary key column (usually 'id', but 'userId' for userProfiles)
  if (dbTable.id) return dbTable.id;
  if (dbTable.userId) return dbTable.userId;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { table, id } = await params;

    const dbTable = tableMap[table];
    if (!dbTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const pkCol = getPrimaryKeyCol(dbTable);
    if (!pkCol) return NextResponse.json({ error: "No primary key defined" }, { status: 400 });

    const rows = await db.select().from(dbTable).where(eq(pkCol, id)).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(`[admin/database/[table]/[id] GET]`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req);
    const { table, id } = await params;

    const dbTable = tableMap[table];
    if (!dbTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const pkCol = getPrimaryKeyCol(dbTable);
    if (!pkCol) return NextResponse.json({ error: "No primary key defined" }, { status: 400 });

    const body = await req.json();

    // Prevent editing immutable tables
    if (table === "audit_logs") {
      return NextResponse.json({ error: "Audit logs are immutable" }, { status: 403 });
    }

    // Get old row for audit
    const oldRows = await db.select().from(dbTable).where(eq(pkCol, id)).limit(1);
    if (oldRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const oldRow = oldRows[0];

    // Filter valid columns for update
    const updates: Record<string, any> = {};
    const metaChanges: any[] = [];

    for (const key of Object.keys(body)) {
      if (key in dbTable && dbTable[key] !== pkCol) {
        let val = body[key];
        
        // Drizzle's timestamp columns expect Date objects, but JSON gives us strings.
        // Convert any ISO-8601 looking string back to a Date object.
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            val = parsed;
          }
        }

        updates[key] = val;
        metaChanges.push({ field: key, oldVal: oldRow[key], newVal: body[key] });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    if (dbTable.updatedAt) {
      updates.updatedAt = new Date();
    }

    await db.update(dbTable).set(updates).where(eq(pkCol, id));

    auditLog({
      event: "admin.record.updated",
      uid: admin.id,
      email: admin.email || "",
      ip: getClientIp(req),
      meta: {
        table,
        rowId: id,
        changes: metaChanges
      }
    });

    return NextResponse.json({ success: true, updates });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(`[admin/database/[table]/[id] PATCH]`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const admin = await verifyAdminToken(req);
    const { table, id } = await params;

    const dbTable = tableMap[table];
    if (!dbTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const pkCol = getPrimaryKeyCol(dbTable);
    if (!pkCol) return NextResponse.json({ error: "No primary key defined" }, { status: 400 });

    // Prevent deleting immutable tables
    if (table === "audit_logs") {
      return NextResponse.json({ error: "Audit logs are immutable" }, { status: 403 });
    }

    // Get row for audit
    const oldRows = await db.select().from(dbTable).where(eq(pkCol, id)).limit(1);
    if (oldRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const oldRow = oldRows[0];

    await db.delete(dbTable).where(eq(pkCol, id));

    auditLog({
      event: "admin.record.deleted",
      uid: admin.id,
      email: admin.email || "",
      ip: getClientIp(req),
      meta: {
        table,
        rowId: id,
        deletedRow: oldRow
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(`[admin/database/[table]/[id] DELETE]`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
