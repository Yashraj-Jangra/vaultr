import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { APIError } from "better-auth/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await auth.api.signUpEmail({
      body,
      headers: req.headers,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json(
        {
          error: err.body?.message ?? err.message,
          ...(err.body?.code ? { code: err.body.code } : {}),
        },
        { status: err.statusCode }
      );
    }
    console.error("[mobile-register]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
