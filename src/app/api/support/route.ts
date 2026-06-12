export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.createdAt));
    return NextResponse.json(tickets);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const [newTicket] = await db.insert(supportTickets).values({
      userId: user.id,
      subject: body.subject,
      priority: body.priority || "normal",
      status: "open",
    }).returning();

    // Send email alert to Admin if configured
    import("@/lib/emailTemplates").then(async ({ createTransporter, sendTemplatedEmail }) => {
      try {
        const conn = await createTransporter();
        if (conn && conn.smtp.supportEmail) {
          // Find APP_URL from origin
          const protocol = req.headers.get("x-forwarded-proto") || "http";
          const host = req.headers.get("host") || "localhost:3000";
          const appUrl = `${protocol}://${host}`;

          await sendTemplatedEmail({
            templateKey: "new_ticket_alert",
            to: conn.smtp.supportEmail,
            vars: {
              USER_EMAIL: user.email || user.id,
              PRIORITY: newTicket.priority,
              TICKET_SUBJECT: newTicket.subject,
              APP_URL: appUrl,
            }
          });
        }
      } catch (e) {
        console.error("Failed to send admin email alert", e);
      }
    });

    return NextResponse.json(newTicket);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
