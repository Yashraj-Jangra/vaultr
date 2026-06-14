import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { userProfiles, vaultItems, session, account, user } from "@/db/schema";
import { auditLog } from "@/lib/auditLog";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    // 1. Orphaned User Profiles (excludes archived ones)
    const orphanedProfilesCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${userProfiles} 
      WHERE user_id NOT IN (SELECT id FROM "user")
      AND deleted_by_admin IS NULL
    `);
    const orphanedProfiles = Number((orphanedProfilesCountRes as any).rows?.[0]?.count ?? 0);

    // 1b. Archived Profiles (expected orphans)
    const archivedProfilesCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${userProfiles} 
      WHERE user_id NOT IN (SELECT id FROM "user")
      AND deleted_by_admin IS NOT NULL
    `);
    const archivedProfiles = Number((archivedProfilesCountRes as any).rows?.[0]?.count ?? 0);

    // 2. Orphaned Vault Items
    const orphanedVaultCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${vaultItems} 
      WHERE user_id NOT IN (SELECT id FROM "user")
    `);
    const orphanedVaultItems = Number((orphanedVaultCountRes as any).rows?.[0]?.count ?? 0);

    // 3. Orphaned Sessions
    const orphanedSessionsCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM "session" 
      WHERE "userId" NOT IN (SELECT id FROM "user")
    `);
    const orphanedSessions = Number((orphanedSessionsCountRes as any).rows?.[0]?.count ?? 0);

    // 4. Orphaned Accounts
    const orphanedAccountsCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM "account" 
      WHERE "userId" NOT IN (SELECT id FROM "user")
    `);
    const orphanedAccounts = Number((orphanedAccountsCountRes as any).rows?.[0]?.count ?? 0);

    // 5. Missing Profiles (Users in auth table with no userProfiles row)
    const missingProfilesCountRes = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM "user" 
      WHERE id NOT IN (SELECT user_id FROM ${userProfiles})
    `);
    const missingProfiles = Number((missingProfilesCountRes as any).rows?.[0]?.count ?? 0);

    return NextResponse.json({
      orphanedProfiles,
      archivedProfiles,
      orphanedVaultItems,
      orphanedSessions,
      orphanedAccounts,
      missingProfiles
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/database/integrity GET]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdminToken(req);
    const body = await req.json();
    const { type } = body;

    let deletedCount = 0;

    if (type === "orphaned_profiles") {
      const res = await db.execute(sql`
        DELETE FROM ${userProfiles} 
        WHERE user_id NOT IN (SELECT id FROM "user")
        AND deleted_by_admin IS NULL
      `);
      deletedCount = (res as any).rowCount ?? 0;
    } else if (type === "orphaned_vault") {
      const res = await db.execute(sql`
        DELETE FROM ${vaultItems} 
        WHERE user_id NOT IN (SELECT id FROM "user")
      `);
      deletedCount = (res as any).rowCount ?? 0;
    } else if (type === "orphaned_sessions") {
      const res = await db.execute(sql`
        DELETE FROM "session" 
        WHERE "userId" NOT IN (SELECT id FROM "user")
      `);
      deletedCount = (res as any).rowCount ?? 0;
    } else if (type === "orphaned_accounts") {
      const res = await db.execute(sql`
        DELETE FROM "account" 
        WHERE "userId" NOT IN (SELECT id FROM "user")
      `);
      deletedCount = (res as any).rowCount ?? 0;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    auditLog({
      event: "admin.integrity.fixed",
      uid: admin.id,
      email: admin.email || "",
      ip: req.headers.get("x-forwarded-for") || undefined,
      meta: {
        action: `Deleted ${type}`,
        deletedCount
      }
    });

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/database/integrity DELETE]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
