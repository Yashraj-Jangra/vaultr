/**
 * src/lib/auth/verifyAdmin.ts
 *
 * Server-side helper to verify a request comes from an admin user.
 * Admin role is verified directly from the profile payload returned by verifyUserToken,
 * avoiding redundant duplicate database round-trips.
 */

import { NextRequest } from "next/server";
import { verifyUserToken, UserPayload } from "./verifyUser";

export interface AdminPayload extends UserPayload {
  role: string;
}

/**
 * Verifies session AND checks that the user has role = 'admin'.
 * Throws a Response (401 or 403) if check fails.
 */
export async function verifyAdminToken(req: NextRequest): Promise<AdminPayload> {
  const user = await verifyUserToken(req);

  if (!user.role || user.role !== "admin") {
    throw new Response(
      JSON.stringify({ error: "Forbidden — admin role required" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return { ...user, role: user.role };
}
