export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { ticketMessages, supportTickets, userProfiles } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { createTransporter, sendTemplatedEmail } from "@/lib/emailTemplates";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { ticketId } = await params;

    // Verify access: Admin can view any, User can only view their own
    const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    // Quick role check
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
    const isAdmin = profile[0]?.role === "admin";
    
    if (!isAdmin && ticket[0].userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const messages = await db.select().from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(asc(ticketMessages.createdAt));
      
    return NextResponse.json(messages);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { ticketId } = await params;
    const body = await req.json();

    // Verify access
    const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
    const isAdmin = profile[0]?.role === "admin";

    if (!isAdmin && ticket[0].userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const [newMessage] = await db.insert(ticketMessages).values({
      ticketId,
      senderId: user.id,
      message: body.message,
    }).returning();

    // Update ticket updatedAt
    await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));

    // Send email alert to Admin if configured
    try {
      const conn = await createTransporter();
      if (conn && conn.smtp.supportEmail) {
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("host") || "localhost:3000";
        const appUrl = `${protocol}://${host}`;

        await sendTemplatedEmail({
          templateKey: "new_ticket_alert",
          to: conn.smtp.supportEmail,
          vars: {
            USER_EMAIL: user.email || user.id,
            PRIORITY: ticket[0].priority,
            TICKET_SUBJECT: ticket[0].subject,
            APP_URL: appUrl,
          }
        });
      }
    } catch (e) {
      console.error("Failed to send admin email alert", e);
    }

    return NextResponse.json(newMessage);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

