import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    
    // Fetch the full session to retrieve the user's image URL
    const sessionResult = await auth.api.getSession({
      headers: req.headers,
    });
    
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: sessionResult?.user?.image || null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/me]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
