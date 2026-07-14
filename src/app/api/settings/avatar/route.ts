export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { uploadAvatar } from "@/lib/storage";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

// ── Allowlists ────────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function checkMagicBytes(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 12) return false;

  switch (extension) {
    case "jpg":
    case "jpeg":
      // JPEG magic bytes: FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case "png":
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );

    case "gif":
      // GIF magic bytes: GIF87a or GIF89a
      return (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61
      );

    case "webp":
      // WebP starts with RIFF (52 49 46 46) and has WEBP (57 45 42 50) at offset 8
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );

    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── Size check ──────────────────────────────────────────────────────────
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 5MB size limit" }, { status: 400 });
    }

    // ── MIME type check (reject attacker-controlled MIME) ───────────────────
    const mimeType = file.type?.toLowerCase();
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // ── Extension check ─────────────────────────────────────────────────────
    const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!rawExt || !ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json(
        { error: "Invalid file extension. Allowed: jpg, jpeg, png, webp, gif" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ── Magic Bytes check ───────────────────────────────────────────────────
    if (!checkMagicBytes(buffer, rawExt)) {
      return NextResponse.json(
        { error: "File content does not match its image extension" },
        { status: 400 }
      );
    }

    // Upload to MinIO using the validated extension
    const avatarUrl = await uploadAvatar(user.id, buffer, mimeType, rawExt);

    // Save to user profiles DB table
    await db
      .insert(userProfiles)
      .values({ userId: user.id, avatarUrl })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { avatarUrl },
      });

    // Update Better Auth user image
    await auth.api.updateUser({
      body: {
        image: avatarUrl,
      },
      headers: req.headers,
    });

    return NextResponse.json({ success: true, avatarUrl });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/settings/avatar]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    // Get current avatar from profile
    const [profile] = await db
      .select({ avatarUrl: userProfiles.avatarUrl })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    if (profile?.avatarUrl) {
      const { deleteAvatar } = await import("@/lib/storage");
      const ext = profile.avatarUrl.split(".").pop()?.toLowerCase() ?? "webp";
      await deleteAvatar(user.id, ext).catch(() => {});
    }

    // Set avatarUrl to null in DB
    await db
      .update(userProfiles)
      .set({ avatarUrl: null })
      .where(eq(userProfiles.userId, user.id));

    // Update Better Auth user image
    await auth.api.updateUser({
      body: {
        image: null,
      },
      headers: req.headers,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/settings/avatar]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
