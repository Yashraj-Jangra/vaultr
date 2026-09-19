export const runtime = "nodejs";

/**
 * /api/vault/attachments
 *
 * POST — upload an encrypted file attachment to MinIO and record it in the DB
 * GET  — list all attachments for a vault item (metadata only, no presigned URLs)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultAttachments, vaultItems, userProfiles } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { uploadAttachment, deleteAttachment } from "@/lib/storage";
import { randomUUID } from "crypto";

const MAX_FILE_BYTES      = 25 * 1024 * 1024; // 25 MB (encrypted blob)
const MAX_PER_VAULT_ITEM  = 10;               // max attachments per entry
const DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024;

// ─── POST /api/vault/attachments ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    let vaultItemId: string | null = null;
    let encryptedName: string | null = null;
    let mimeType: string = "application/octet-stream";
    let bytes: ArrayBuffer | null = null;
    let size: number = 0;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData       = await req.formData();
      vaultItemId    = formData.get("vaultItemId") as string | null;
      const encryptedFile  = formData.get("encryptedFile") as File | null;
      encryptedName  = formData.get("encryptedName") as string | null;
      mimeType       = (formData.get("mimeType") as string | null) ?? "application/octet-stream";
      if (encryptedFile) {
        bytes = await encryptedFile.arrayBuffer();
        size = encryptedFile.size;
      }
    } else {
      vaultItemId = req.headers.get("x-vault-item-id");
      const rawName = req.headers.get("x-encrypted-name");
      if (rawName) encryptedName = decodeURIComponent(rawName);
      mimeType = req.headers.get("x-mime-type") ?? "application/octet-stream";
      bytes = await req.arrayBuffer();
      size = bytes.byteLength;
    }

    // ── Field validation ─────────────────────────────────────────────────────
    if (!vaultItemId || !bytes || size === 0 || !encryptedName) {
      return NextResponse.json(
        { error: "Missing required fields: vaultItemId, encryptedFile, encryptedName" },
        { status: 400 }
      );
    }
    const targetVaultItemId = vaultItemId;
    const storedEncryptedName = encryptedName;

    // ── Vault item ownership check ────────────────────────────────────────────
    const [item] = await db
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.id, targetVaultItemId), eq(vaultItems.userId, user.id)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    // ── File size check ───────────────────────────────────────────────────────
    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the 25 MB limit (got ${(size / 1024 / 1024).toFixed(1)} MB)` },
        { status: 400 }
      );
    }

    // ── Per-item attachment count check ───────────────────────────────────────
    const [{ total }] = await db
      .select({ total: count() })
      .from(vaultAttachments)
      .where(
        and(
          eq(vaultAttachments.vaultItemId, targetVaultItemId),
          eq(vaultAttachments.userId, user.id)
        )
      );

    if (Number(total) >= MAX_PER_VAULT_ITEM) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PER_VAULT_ITEM} attachments per vault entry` },
        { status: 400 }
      );
    }

    // ── Storage quota check ───────────────────────────────────────────────────
    // Profiles created by older clients may not have a companion row yet.
    // Ensure one exists so quota reservation can always be an atomic UPDATE.
    await db
      .insert(userProfiles)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: userProfiles.userId });

    const [profile] = await db
      .select({
        usedBytes:  userProfiles.storageUsedBytes,
        quotaBytes: userProfiles.storageQuotaBytes,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const usedBytes  = profile?.usedBytes  ?? 0;
    const quotaBytes = profile?.quotaBytes ?? DEFAULT_QUOTA_BYTES;

    if (usedBytes + size > quotaBytes) {
      const remainingMB = ((quotaBytes - usedBytes) / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        { error: `Storage quota exceeded. You have ${remainingMB} MB remaining.` },
        { status: 413 }
      );
    }

    // ── Upload to MinIO & Insert DB row (with atomic rollback) ────────────────
    const attachmentId = randomUUID();
    const buffer = Buffer.from(bytes);

    let s3Key: string | null = null;
    try {
      const uploadedS3Key = await uploadAttachment(
        user.id,
        targetVaultItemId,
        attachmentId,
        buffer,
        mimeType
      );
      s3Key = uploadedS3Key;

      // Reserve quota and create the attachment row atomically. The conditional
      // UPDATE serializes concurrent uploads for the same profile, so only the
      // uploads that still fit can commit.
      const attachment = await db.transaction(async (tx) => {
        const [reserved] = await tx
          .update(userProfiles)
          .set({
            storageUsedBytes: sql`COALESCE(${userProfiles.storageUsedBytes}, 0) + ${size}`,
          })
          .where(
            and(
              eq(userProfiles.userId, user.id),
              sql`COALESCE(${userProfiles.storageUsedBytes}, 0) + ${size} <= COALESCE(${userProfiles.storageQuotaBytes}, ${DEFAULT_QUOTA_BYTES})`
            )
          )
          .returning({ userId: userProfiles.userId });

        if (!reserved) {
          return null;
        }

        const [created] = await tx
          .insert(vaultAttachments)
          .values({
            id:            attachmentId,
            vaultItemId:   targetVaultItemId,
            userId:        user.id,
            encryptedName: storedEncryptedName,
            mimeType,
            sizeBytes:     size,
            s3Key:          uploadedS3Key,
          })
          .returning();

        return created;
      });

      if (!attachment) {
        await deleteAttachment(uploadedS3Key);
        s3Key = null;
        const remainingMB = Math.max(0, (quotaBytes - usedBytes) / 1024 / 1024).toFixed(1);
        return NextResponse.json(
          { error: `Storage quota exceeded. You have ${remainingMB} MB remaining.` },
          { status: 413 }
        );
      }

      return NextResponse.json({ attachment }, { status: 201 });
    } catch (uploadOrDbErr) {
      if (s3Key) {
        try {
          await deleteAttachment(s3Key);
        } catch (cleanupErr) {
          console.error("[POST /api/vault/attachments] Failed to cleanup orphaned S3 object:", cleanupErr);
        }
      }
      throw uploadOrDbErr;
    }
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/attachments]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── GET /api/vault/attachments?vaultItemId=<id> ─────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user        = await verifyUserToken(req);
    const vaultItemId = req.nextUrl.searchParams.get("vaultItemId");

    if (!vaultItemId) {
      return NextResponse.json({ error: "Missing vaultItemId query param" }, { status: 400 });
    }

    // Verify the vault item belongs to the user
    const [item] = await db
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.id, vaultItemId), eq(vaultItems.userId, user.id)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const attachments = await db
      .select({
        id:            vaultAttachments.id,
        encryptedName: vaultAttachments.encryptedName,
        mimeType:      vaultAttachments.mimeType,
        sizeBytes:     vaultAttachments.sizeBytes,
        createdAt:     vaultAttachments.createdAt,
      })
      .from(vaultAttachments)
      .where(
        and(
          eq(vaultAttachments.vaultItemId, vaultItemId),
          eq(vaultAttachments.userId, user.id)
        )
      )
      .orderBy(vaultAttachments.createdAt);

    return NextResponse.json({ attachments });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/attachments]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
