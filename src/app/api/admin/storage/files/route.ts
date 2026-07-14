export const runtime = "nodejs";

/**
 * /api/admin/storage/files
 *
 * GET — paginated file browser for the admin panel.
 *       Optional ?userId filter to scope to one user.
 *       Admin cannot read encrypted content — zero-knowledge preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";

import { db } from "@/db";
import { vaultAttachments, vaultItems, user } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const { searchParams } = req.nextUrl;
    const userId  = searchParams.get("userId") ?? undefined;
    const page    = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit   = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
    const offset  = (page - 1) * limit;

    // Build query
    const conditions = userId
      ? [eq(vaultAttachments.userId, userId)]
      : [];

    const files = await db
      .select({
        id:            vaultAttachments.id,
        vaultItemId:   vaultAttachments.vaultItemId,
        userId:        vaultAttachments.userId,
        mimeType:      vaultAttachments.mimeType,
        sizeBytes:     vaultAttachments.sizeBytes,
        s3Key:         vaultAttachments.s3Key,
        createdAt:     vaultAttachments.createdAt,
        // Vault item name (encrypted — shown as-is, admin cannot decrypt)
        vaultItemName: vaultItems.name,
        // User info
        userName:  user.name,
        userEmail: user.email,
      })
      .from(vaultAttachments)
      .leftJoin(vaultItems, eq(vaultAttachments.vaultItemId, vaultItems.id))
      .leftJoin(user, eq(vaultAttachments.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vaultAttachments.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ files, page, limit });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/admin/storage/files]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/storage/files
 *
 * Admin force-delete an attachment by id.
 * Used for moderation (content policy enforcement).
 * Zero-knowledge is preserved — admin never reads the file content.
 */
export async function DELETE(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { deleteAttachment } = await import("@/lib/storage");
    const { sql }              = await import("drizzle-orm");
    const { userProfiles }     = await import("@/db/schema");

    const [attachment] = await db
      .select()
      .from(vaultAttachments)
      .where(eq(vaultAttachments.id, id))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Delete from S3
    await deleteAttachment(attachment.s3Key);

    // Remove DB row
    await db.delete(vaultAttachments).where(eq(vaultAttachments.id, id));

    // Decrement user's storage counter
    await db
      .update(userProfiles)
      .set({
        storageUsedBytes: sql`GREATEST(${userProfiles.storageUsedBytes} - ${attachment.sizeBytes}, 0)`,
      })
      .where(eq(userProfiles.userId, attachment.userId))
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/admin/storage/files]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
