import { NextResponse } from "next/server";
import { db } from "@/db";
import { user, account, session, vaultItems } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    // Delete all vault items first due to foreign keys (if any)
    await db.delete(vaultItems);
    await db.delete(session);
    await db.delete(account);
    await db.delete(user);
    
    return NextResponse.json({ success: true, message: "All accounts deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
