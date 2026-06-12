export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();
    const { ticketIds, status, priority } = body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: "No tickets provided" }, { status: 400 });
    }

    const updates: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (priority) updates.priority = priority;

    const updatedTickets = await db.update(supportTickets)
      .set(updates)
      .where(inArray(supportTickets.id, ticketIds))
      .returning();

    return NextResponse.json(updatedTickets);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();
    const { ticketIds } = body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: "No tickets provided" }, { status: 400 });
    }

    await db.delete(supportTickets).where(inArray(supportTickets.id, ticketIds));

    return NextResponse.json({ success: true, count: ticketIds.length });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
