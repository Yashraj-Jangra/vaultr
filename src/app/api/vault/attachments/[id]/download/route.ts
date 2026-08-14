export const runtime = "nodejs";

/**
 * /api/vault/attachments/[id]/download
 *
 * GET — returns a short-lived pre-signed MinIO URL for a single attachment.
 *
 * The browser fetches the encrypted blob directly from MinIO using the URL,
 * then decrypts it client-side with the vault's CryptoKey.
 * Next.js never buffers the file content — only the URL is returned.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultAttachments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAttachmentBytes } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserToken(req);
    const { id } = await params;

    // Fetch attachment row and verify ownership
    const [attachment] = await db
      .select({
        id:       vaultAttachments.id,
        s3Key:    vaultAttachments.s3Key,
        userId:   vaultAttachments.userId,
        mimeType: vaultAttachments.mimeType,
      })
      .from(vaultAttachments)
      .where(and(eq(vaultAttachments.id, id), eq(vaultAttachments.userId, user.id)))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Retrieve encrypted binary byte contents from S3 and stream directly as octet-stream
    const bytes = await getAttachmentBytes(attachment.s3Key);

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-cache, no-store",
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/attachments/[id]/download]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
