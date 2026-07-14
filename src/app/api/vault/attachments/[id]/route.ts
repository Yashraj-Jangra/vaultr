export const runtime = "nodejs";

/**
 * /api/vault/attachments/[id]
 *
 * DELETE — remove an attachment from MinIO + DB + decrement user storage quota
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultAttachments, userProfiles } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { deleteAttachment } from "@/lib/storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { id } = await params;

    // Fetch the attachment row — verify ownership before touching S3
    const [attachment] = await db
      .select()
      .from(vaultAttachments)
      .where(and(eq(vaultAttachments.id, id), eq(vaultAttachments.userId, user.id)))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Delete from MinIO first (if this fails, we don't touch the DB)
    await deleteAttachment(attachment.s3Key);

    // Remove the DB row
    await db
      .delete(vaultAttachments)
      .where(and(eq(vaultAttachments.id, id), eq(vaultAttachments.userId, user.id)));

    // Decrement the user's storage counter (floor at 0)
    await db
      .update(userProfiles)
      .set({
        storageUsedBytes: sql`GREATEST(${userProfiles.storageUsedBytes} - ${attachment.sizeBytes}, 0)`,
      })
      .where(eq(userProfiles.userId, user.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/vault/attachments/[id]]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
