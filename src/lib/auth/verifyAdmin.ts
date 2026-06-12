/**
 * src/lib/auth/verifyAdmin.ts
 *
 * Server-side helper to verify a request comes from an admin user.
 *
 * Admin status is stored in user_profiles.role = 'admin' (our own table),
 * not in a JWT claim like JWT custom claims.
 */

import { NextRequest } from "next/server";
import { verifyUserToken, UserPayload } from "./verifyUser";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AdminPayload extends UserPayload {
  role: string;
}

/**
 * Verifies session AND checks that the user has role = 'admin' in user_profiles.
 * Throws a Response (401 or 403) if check fails.
 */
export async function verifyAdminToken(req: NextRequest): Promise<AdminPayload> {
  const user = await verifyUserToken(req);

  const [profile] = await db
    .select({ role: userProfiles.role, disabled: userProfiles.disabled })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  if (!profile || profile.role !== "admin") {
    throw new Response(
      JSON.stringify({ error: "Forbidden — admin role required" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return { ...user, role: profile.role };
}
