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
