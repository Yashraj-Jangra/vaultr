/**
 * src/lib/storage.ts
 *
 * MinIO S3-compatible file storage client.
 * Replaces: Firebase Storage
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
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 client configured to talk to local MinIO instance
export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9000",
  region: "us-east-1",          // MinIO requires any string here; value is ignored
  credentials: {
    accessKeyId:     process.env.MINIO_ROOT_USER     ?? "vaultr",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "",
  },
  forcePathStyle: true,          // Required for MinIO (vs AWS S3 virtual-hosted style)
});

const AVATAR_BUCKET = process.env.MINIO_BUCKET_AVATARS ?? "avatars";

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

  await s3.send(
    new PutObjectCommand({
      Bucket:      AVATAR_BUCKET,
      Key:         key,
      Body:        file,
      ContentType: contentType,
    })
  );

  // Return the public URL (bucket must be set to public read in MinIO console)
  return `${process.env.MINIO_ENDPOINT}/${AVATAR_BUCKET}/${key}`;
}

/**
 * Delete a user's avatar.
 */
export async function deleteAvatar(userId: string, extension = "webp"): Promise<void> {
  const key = `${userId}/avatar.${extension}`;
  await s3.send(new DeleteObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
}

/**
 * Generate a short-lived pre-signed URL for a private file (if needed in future).
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
