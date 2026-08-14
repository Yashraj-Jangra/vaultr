export const runtime = "nodejs";

import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeError } from "@/lib/safeError";

import { deleteAvatar, deleteAllUserAttachments } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    // 1. Purge user avatar and encrypted file attachments from MinIO S3
    await Promise.all([
      deleteAvatar(user.id).catch(() => {}),
      deleteAllUserAttachments(user.id).catch(() => {}),
    ]);

    // 2. Delete all vault items
    await db.delete(vaultItems).where(eq(vaultItems.userId, user.id));

    // 3. Delete user profile settings
    await db.delete(userProfiles).where(eq(userProfiles.userId, user.id));

    // 4. Delete Better Auth user record (also cascades to accounts and sessions)
    await auth.api.deleteUser({
      body: {},
      headers: req.headers,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[delete-account POST]", err);
    return NextResponse.json({ error: safeError(err) }, { status: 500 });
  }
}
