/**
 * src/lib/auth/verifyUser.ts
 *
 * Server-side helper to verify a request comes from an authenticated,
 * non-disabled user. Also updates session metadata (last active, device info)
 * on a 5-minute throttle so the Sessions UI stays accurate.
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
import { trackSession } from "@/lib/sessionMeta";

export interface UserPayload {
  id: string;         // Better Auth user ID
  sessionId: string;  // Better Auth session ID
  email: string | null | undefined;
  name: string | null | undefined;
}

/**
 * Verifies the session from incoming request headers AND checks that the
 * user account has not been disabled by an admin.
 *
 * Also fires a non-blocking session metadata upsert (device name, IP,
 * last-active timestamp) so the sessions panel always shows fresh data.
 *
 * Throws a Response (401 / 403) if the check fails.
 */
export async function verifyUserToken(req: NextRequest): Promise<UserPayload> {
  const sessionResult = await auth.api.getSession({
    headers: req.headers,
  });

  if (!sessionResult?.user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized — no valid session" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check if this account has been disabled by an admin
  const [profile] = await db
    .select({ disabled: userProfiles.disabled })
    .from(userProfiles)
    .where(eq(userProfiles.userId, sessionResult.user.id))
    .limit(1);

  if (profile?.disabled) {
    throw new Response(
      JSON.stringify({ error: "Forbidden — account has been disabled" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Update session metadata in the background (non-blocking)
  // Uses DB-level 5-minute throttle so this is cheap on every request
  if (sessionResult.session?.id) {
    trackSession(sessionResult.session.id, sessionResult.user.id, req).catch(
      () => { /* non-critical — never break auth flow */ }
    );
  }

  return {
    id:        sessionResult.user.id,
    sessionId: sessionResult.session?.id ?? "",
    email:     sessionResult.user.email,
    name:      sessionResult.user.name,
  };
}
