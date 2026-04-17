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
 *
 * Email enrichment:
 *   Custom Firebase tokens (Web3 / SIWE users authenticated via createCustomToken)
 *   carry zero email claims. When `decoded.email` is absent, we fall back to
 *   adminAuth.getUser(uid) to resolve the email from the full Auth user record —
 *   e.g. if the user has a linked Google account, that email will be available there.
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

    // ── Email enrichment ──────────────────────────────────────────────────────
    // ID tokens minted from custom tokens (e.g. SIWE/Web3 flow) do not carry an
    // email claim. Fall back to the full user record to resolve a linked email.
    let email: string | undefined = decoded.email;
    if (!email) {
      try {
        const record = await adminAuth.getUser(decoded.uid);
        email = record.email;
      } catch {
        // Not fatal — email stays undefined; callers must handle the optional.
      }
    }

    return { uid: decoded.uid, email };
  } catch (err) {
    if (err instanceof Response) throw err;
    throw new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
}
