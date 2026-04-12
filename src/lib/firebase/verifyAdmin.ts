import { adminAuth } from "@/lib/firebase/admin";
import { NextRequest } from "next/server";

export interface AdminTokenPayload {
  uid: string;
  email?: string;
}

/**
 * Extracts and verifies a Firebase ID token from the Authorization header.
 * Throws a Response with 401 or 403 status if verification fails.
 */
export async function verifyAdminToken(
  req: NextRequest
): Promise<AdminTokenPayload> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    throw new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!adminAuth) {
    throw new Response(
      JSON.stringify({ error: "Firebase Admin SDK not initialized — check server env vars" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.admin) {
      throw new Response(
        JSON.stringify({ error: "Forbidden — admin claim required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
}
