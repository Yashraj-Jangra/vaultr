export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    return NextResponse.json(tickets);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();
    const { ticketId, status, priority } = body;

    const [updatedTicket] = await db.update(supportTickets)
      .set({ status, priority, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    return NextResponse.json(updatedTicket);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
