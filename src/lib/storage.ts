/**
 * src/lib/storage.ts
 *
 * MinIO S3-compatible file storage client.
 * Replaces: Local Storage
 *
 * This file is SERVER-ONLY. Never import in client components.
 *
 * MinIO runs in Docker (see docker-compose.yml).
 * Data stored in named volume vaultr_miniodata — persists across container restarts.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Ensure a bucket exists in S3/MinIO. If it does not, create it.
 * If isPublic is true, set bucket policy to allow public reads.
 */
async function ensureBucketExists(bucket: string, isPublic = false): Promise<void> {
  let created = false;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: any) {
    // NotFound error or 404 status indicates bucket does not exist
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`[Storage] Created bucket: "${bucket}"`);
        created = true;
      } catch (createErr) {
        console.error(`[Storage] Failed to automatically create bucket "${bucket}":`, createErr);
      }
    }
  }

  // If public bucket was just created, configure the policy
  if (isPublic && created) {
    try {
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };
      await s3.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify(policy),
        })
      );
      console.log(`[Storage] Configured public read policy for bucket: "${bucket}"`);
    } catch (policyErr) {
      // Catch silently to avoid cluttering startup logs on S3-compatible environments with limited permissions
    }
  }
}

// ─── Two separate endpoint references ───────────────────────────────────────
//
// MINIO_ENDPOINT       — used by the S3 SDK for server-side operations.
//                        In Docker this is the internal hostname: http://minio:9000
//
// MINIO_PUBLIC_URL     — used when building URLs that are returned to browsers.
//                        Set this to your public-facing domain, e.g. https://api.example.com
//                        Falls back to MINIO_ENDPOINT if not set (fine for local dev).
//
const MINIO_S3_ENDPOINT  = process.env.MINIO_ENDPOINT   ?? "http://localhost:9000";
export const MINIO_PUBLIC_BASE = (
  process.env.MINIO_PUBLIC_URL ?? MINIO_S3_ENDPOINT
).replace(/\/$/, ""); // strip trailing slash

// S3 client configured to talk to local MinIO instance
export const s3 = new S3Client({
  endpoint: MINIO_S3_ENDPOINT,
  region: "us-east-1",          // MinIO requires any string here; value is ignored
  credentials: {
    accessKeyId:     process.env.MINIO_ROOT_USER     ?? "vaultr",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "",
  },
  forcePathStyle: true,          // Required for MinIO (vs AWS S3 virtual-hosted style)
  requestChecksumCalculation: "WHEN_REQUIRED", // Disable default CRC32 checksums for MinIO/S3-compatible compatibility
});

export const AVATAR_BUCKET      = process.env.MINIO_BUCKET_AVATARS      ?? "avatars";
export const ATTACHMENTS_BUCKET = process.env.MINIO_BUCKET_ATTACHMENTS  ?? "attachments";

// Trigger self-healing initialization for both buckets immediately
ensureBucketExists(AVATAR_BUCKET, true).catch((e) =>
  console.error(`[Storage] Error initializing avatar bucket:`, e)
);
ensureBucketExists(ATTACHMENTS_BUCKET, false).catch((e) =>
  console.error(`[Storage] Error initializing attachments bucket:`, e)
);

// ─── Avatars ──────────────────────────────────────────────────────────────────

/**
 * Upload a user's profile avatar.
 * Returns the public URL of the uploaded file.
 *
 * Naming convention: avatars/{userId}/avatar.{ext}
 * Overwriting the same key updates the avatar in-place.
 */
export async function uploadAvatar(
  userId: string,
  file: Buffer,
  contentType: string,
  extension = "webp"
): Promise<string> {
  const key = `${userId}/avatar.${extension}`;

  await ensureBucketExists(AVATAR_BUCKET, true);

  await s3.send(
    new PutObjectCommand({
      Bucket:      AVATAR_BUCKET,
      Key:         key,
      Body:        file,
      ContentType: contentType,
    })
  );

  // Return the PUBLIC URL (browser-facing) — NOT the internal S3 endpoint
  return `${MINIO_PUBLIC_BASE}/${AVATAR_BUCKET}/${key}`;
}

/**
 * Delete a user's avatar.
 */
export async function deleteAvatar(userId: string, extension = "webp"): Promise<void> {
  const key = `${userId}/avatar.${extension}`;
  await s3.send(new DeleteObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
}

// ─── Attachments ──────────────────────────────────────────────────────────────
// Files are AES-GCM encrypted client-side before upload.
// The server stores opaque encrypted bytes — it never sees plaintext content.
// Key pattern: {userId}/{vaultItemId}/{attachmentId}.enc

/**
 * Upload an encrypted file attachment to MinIO.
 * Returns the S3 key (stored in the vault_attachments DB row).
 */
export async function uploadAttachment(
  userId: string,
  vaultItemId: string,
  attachmentId: string,
  encryptedBytes: Buffer,
  mimeType: string
): Promise<string> {
  const key = `${userId}/${vaultItemId}/${attachmentId}.enc`;

  await ensureBucketExists(ATTACHMENTS_BUCKET, false);

  await s3.send(
    new PutObjectCommand({
      Bucket:      ATTACHMENTS_BUCKET,
      Key:         key,
      Body:        encryptedBytes,
      ContentType: "application/octet-stream",
      Metadata:    { "x-original-mime": mimeType },
    })
  );

  return key;
}

/**
 * Delete a single attachment by its S3 key.
 */
export async function deleteAttachment(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: s3Key }));
}

/**
 * Bulk-delete all attachments belonging to a vault item.
 * Called when a vault item is hard-deleted so no orphaned S3 objects remain.
 */
export async function deleteAttachmentsByVaultItem(
  userId: string,
  vaultItemId: string
): Promise<void> {
  const prefix = `${userId}/${vaultItemId}/`;
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: ATTACHMENTS_BUCKET, Prefix: prefix })
  );

  const keys = (listed.Contents ?? []).map((obj) => obj.Key).filter(Boolean) as string[];
  await Promise.all(keys.map((k) => deleteAttachment(k)));
}

/**
 * Generate a short-lived pre-signed URL so the browser can download
 * an encrypted attachment directly from MinIO (bypassing Next.js).
 * Default TTL: 5 minutes. The client decrypts the file after download.
 */
export async function getAttachmentPresignedUrl(
  s3Key: string,
  ttlSeconds = 300
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: s3Key }),
    { expiresIn: ttlSeconds }
  );
}

/**
 * Generate a short-lived pre-signed URL for any private file (generic helper).
 */
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Retrieve the raw encrypted text contents of an attachment directly from S3.
 */
export async function getAttachmentContent(s3Key: string): Promise<string> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: s3Key })
  );
  const data = await response.Body?.transformToString();
  if (data === undefined) {
    throw new Error("Failed to read S3 object body");
  }
  return data;
}
