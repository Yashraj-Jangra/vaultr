export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { uploadAvatar } from "@/lib/storage";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Limit avatar size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5MB size limit" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Infer content-type and extension
    const contentType = file.type || "image/webp";
    const extension = file.name.split(".").pop() || "webp";

    // Upload to MinIO
    const avatarUrl = await uploadAvatar(user.id, buffer, contentType, extension);

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
