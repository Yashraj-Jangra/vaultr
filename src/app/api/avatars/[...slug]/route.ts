/**
 * src/app/api/avatars/[...slug]/route.ts
 *
 * Proxy endpoint for serving user avatars from the private MinIO bucket.
 * The browser requests /api/avatars/{userId}/avatar.{ext} and this route
 * fetches the object from MinIO using server-side S3 credentials and streams
 * it back — no public bucket policy needed.
 *
 * URLs are cached at the edge for 1 year (immutable). Re-uploads overwrite
 * the same key so the path stays stable; browsers receive fresh content
 * because the CDN/cache busting is handled by the filename key.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, AVATAR_BUCKET } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return new NextResponse("Not found", { status: 404 });
    }

    const key = slug.join("/"); // e.g. "abc123/avatar.webp"

    const obj = await s3.send(
      new GetObjectCommand({ Bucket: AVATAR_BUCKET, Key: key })
    );

    if (!obj.Body) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Stream the S3 body directly to the response
    const bytes = Buffer.from(await obj.Body.transformToByteArray());

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": obj.ContentType ?? "image/webp",
        "Content-Length": String(bytes.byteLength),
        // Cache aggressively — avatar key is stable, overwrites replace content in-place
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    if (
      err.name === "NoSuchKey" ||
      err.$metadata?.httpStatusCode === 404
    ) {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("[GET /api/avatars]", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
