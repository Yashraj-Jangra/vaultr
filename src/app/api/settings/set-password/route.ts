export const runtime = "nodejs";

import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user is authenticated
    await verifyUserToken(req);
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // 2. Call Better Auth server API to set the password for this session
    await auth.api.setPassword({
      body: {
        newPassword: password,
      },
      headers: req.headers,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[set-password POST]", err);
    return NextResponse.json({ error: (err as Error).message || "Internal Server Error" }, { status: 500 });
  }
}
