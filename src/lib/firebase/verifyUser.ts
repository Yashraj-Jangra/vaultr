import { adminAuth } from "@/lib/firebase/admin";
import { NextRequest } from "next/server";

export interface UserTokenPayload {
  uid: string;
  email?: string;
}

/**
 * Verifies a Firebase ID token from the Authorization header.
 * Unlike verifyAdmin.ts, this does NOT require the admin custom claim.
 * Use this for user-owned API routes (session management, device verification, etc.)
 */
export async function verifyUserToken(req: NextRequest): Promise<UserTokenPayload> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!adminAuth) {
    throw new Response(
      JSON.stringify({ error: "Firebase Admin SDK not initialized" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
}
