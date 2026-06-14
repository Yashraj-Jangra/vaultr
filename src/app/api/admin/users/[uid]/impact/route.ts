export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { vaultItems, userProfiles, session, account, twoFactor, supportTickets, ticketMessages, auditLogs } from "@/db/schema";
import { auth } from "@/lib/auth/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdminToken(req);
    const { uid } = await params;

    // Fetch user details from Better Auth to ensure they exist
    const userRes = await auth.api.listUsers({
      query: { limit: 1 },
      // We can't query by exact ID easily with listUsers if it doesn't support it, 
      // but we can query our db directly since we have the schema.
    });
    // Wait, Better Auth doesn't have a direct getUser by id admin API without the id in the token?
    // Let's just query the db directly.
    const userRow = await db.execute(sql`SELECT * FROM "user" WHERE id = ${uid} LIMIT 1`);
    
    // We will still calculate impact even if the user row doesn't exist, as it could be an orphaned profile.
    const exists = userRow.rows.length > 0;
    const userData = exists ? userRow.rows[0] : null;

    // Count everything
    const vaultCount = await db.select({ count: sql`count(*)` }).from(vaultItems).where(eq(vaultItems.userId, uid));
    const profileCount = await db.select({ count: sql`count(*)` }).from(userProfiles).where(eq(userProfiles.userId, uid));
    const sessionCount = await db.select({ count: sql`count(*)` }).from(session).where(eq(session.userId, uid));
    const accountCount = await db.select({ count: sql`count(*)` }).from(account).where(eq(account.userId, uid));
    const twoFactorCount = await db.select({ count: sql`count(*)` }).from(twoFactor).where(eq(twoFactor.userId, uid));
    const ticketCount = await db.select({ count: sql`count(*)` }).from(supportTickets).where(eq(supportTickets.userId, uid));
    
    // Ticket messages sent by this user
    const messageCount = await db.select({ count: sql`count(*)` }).from(ticketMessages).where(eq(ticketMessages.senderId, uid));
    
    // Audit logs for this user
    const auditCount = await db.select({ count: sql`count(*)` }).from(auditLogs).where(eq(auditLogs.userId, uid));

    return NextResponse.json({
      userId: uid,
      email: userData ? (userData as any).email : "Unknown",
      displayName: userData ? (userData as any).name : "Unknown",
      userExists: exists,
      impact: {
        vaultItems: Number(vaultCount[0]?.count || 0),
        userProfile: Number(profileCount[0]?.count || 0) > 0,
        sessions: Number(sessionCount[0]?.count || 0),
        accounts: Number(accountCount[0]?.count || 0),
        twoFactor: Number(twoFactorCount[0]?.count || 0),
        supportTickets: Number(ticketCount[0]?.count || 0),
        ticketMessages: Number(messageCount[0]?.count || 0),
        auditLogs: Number(auditCount[0]?.count || 0)
      }
    });

  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/users/[uid]/impact GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
