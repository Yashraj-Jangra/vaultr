export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { ticketMessages, supportTickets, userProfiles } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { sendTemplatedEmail, createTransporter } from "@/lib/emailTemplates";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { ticketId } = await params;

    const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    await verifyAdminToken(req);
    const { ticketId } = await params;
    const body = await req.json();
    const { message, sendEmail } = body;

    const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [newMessage] = await db.insert(ticketMessages).values({
      ticketId,
      senderId: "ADMIN",
      message: message,
    }).returning();

    // Update ticket updatedAt and optionally status
    await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));

    if (sendEmail) {
      const userProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, ticket[0].userId)).limit(1);
      const userEmail = userProfile[0]?.email;
      
      if (userEmail) {
        // Find APP_URL from origin
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("host") || "localhost:3000";
        const appUrl = `${protocol}://${host}`;

        try {
          await sendTemplatedEmail({
            templateKey: "support_reply",
            to: userEmail,
            vars: {
              TICKET_SUBJECT: ticket[0].subject,
              MESSAGE: message,
              APP_URL: appUrl
            }
          });
        } catch (e) {
          console.error("Failed to send email", e);
        }
      }
    }

    return NextResponse.json(newMessage);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
