/**
 * src/lib/auth/verifyUser.ts
 *
 * Server-side helper to verify a request comes from an authenticated,
 * non-disabled user.
 *
 * Better Auth uses HttpOnly cookies for sessions — no manual Bearer token needed
 * for browser-initiated requests. For server-to-server calls, the session cookie
 * is forwarded automatically via req.headers.
 */

import { NextRequest } from "next/server";
import { auth } from "./auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface UserPayload {
  id: string;         // Better Auth user ID
  email: string | null | undefined;
  name: string | null | undefined;
}

/**
 * Verifies the session from incoming request headers AND checks that the
 * user account has not been disabled by an admin.
 *
 * Throws a Response (401 / 403) if the check fails.
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

  // Check if this account has been disabled by an admin
  const [profile] = await db
    .select({ disabled: userProfiles.disabled })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);

  if (profile?.disabled) {
    throw new Response(
      JSON.stringify({ error: "Forbidden — account has been disabled" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
