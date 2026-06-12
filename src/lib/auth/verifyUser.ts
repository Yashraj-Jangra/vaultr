/**
 * src/lib/auth/verifyUser.ts
 *
 * Server-side helper to verify a request comes from an authenticated user.
 *
 * Better Auth uses HttpOnly cookies for sessions — no manual Bearer token needed
 * for browser-initiated requests. For server-to-server calls, the session cookie
 * is forwarded automatically via req.headers.
 */

import { NextRequest } from "next/server";
import { auth } from "./auth";

export interface UserPayload {
  id: string;         // Better Auth user ID
  email: string | null | undefined;
  name: string | null | undefined;
}

/**
 * Verifies the session from incoming request headers.
 * Throws a Response (401) if no valid session exists.
 */
export async function verifyUserToken(req: NextRequest): Promise<UserPayload> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized — no valid session" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
