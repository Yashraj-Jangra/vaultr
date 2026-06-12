/**
 * src/app/api/auth/[...all]/route.ts
 *
 * Better Auth catch-all handler.
 * Handles all auth endpoints:
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   GET  /api/auth/sign-out
 *   GET  /api/auth/session
 *   GET  /api/auth/callback/google
 *   ...and all other Better Auth routes
 */

export const runtime = "nodejs";

import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
