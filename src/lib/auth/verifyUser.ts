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
 *
 * NOTE: Better Auth with cookieCache enabled may return `session.id` equal to the
 * session token (the 32-char cookie value) instead of the actual DB primary key.
 * We resolve this via resolveSessionId() before passing the ID anywhere that
 * performs FK lookups (session_meta, session list, isCurrent detection).
 */

import { NextRequest } from "next/server";
import { auth } from "./auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveSessionId, trackSession } from "@/lib/sessionMeta";

export interface UserPayload {
  id: string;         // Better Auth user ID
  sessionId: string;  // Resolved DB session.id (real PK, not the cookie token)
  email: string | null | undefined;
  name: string | null | undefined;
}

/**
 * Verifies the session from incoming request headers AND checks that the
 * user account has not been disabled by an admin.
 *
 * Resolves the real DB session.id (handles Better Auth cookieCache quirk).
 * Fires a non-blocking session metadata upsert (device name, IP, last-active).
 *
 * Throws a Response (401 / 403) if the check fails.
 */
export async function verifyUserToken(req: NextRequest): Promise<UserPayload> {
  console.log("[verifyUserToken] Headers Authorization:", req.headers.get("authorization"));
  console.log("[verifyUserToken] Headers Cookie:", req.headers.get("cookie"));

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

  // Resolve the real DB session.id — Better Auth cookieCache may return the
  // session token string in place of the actual PK, so we normalise here once.
  // If the session doesn't exist in the DB (truly stale), fall back gracefully.
  const rawSessionId = sessionResult.session?.id ?? "";
  let resolvedSessionId = rawSessionId;

  if (rawSessionId) {
    const real = await resolveSessionId(rawSessionId);
    if (real) {
      resolvedSessionId = real;
    } else {
      // The session no longer exists in the DB (it was revoked or expired).
      // Even if Better Auth's cookie/jwt cache says it's valid, reject it!
      throw new Response(
        JSON.stringify({ error: "Unauthorized — session revoked" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Update session metadata in the background (non-blocking).
  // Uses DB-level 5-minute throttle so this is cheap on every request.
  if (resolvedSessionId) {
    trackSession(resolvedSessionId, sessionResult.user.id, req).catch(
      () => { /* non-critical — never break auth flow */ }
    );
  }

  return {
    id:        sessionResult.user.id,
    sessionId: resolvedSessionId,
    email:     sessionResult.user.email,
    name:      sessionResult.user.name,
  };
}
