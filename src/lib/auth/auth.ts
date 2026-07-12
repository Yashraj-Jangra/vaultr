/**
 * src/lib/auth/auth.ts
 *
 * Better Auth server configuration.
 * This file is SERVER-ONLY — never import in client components.
 *
 * Handles: email/password auth, Google OAuth, session management.
 * Better Auth auto-creates its own user/session/account/verification tables
 * on the first migration run (separate from our app schema tables).
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { admin, twoFactor } from "better-auth/plugins";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";

// ── Trusted Origins ──────────────────────────────────────────────────────────
// Only explicitly listed origins are trusted. No wildcards.
// Add extra origins via TRUSTED_ORIGINS env var (comma-separated).
const trustedOrigins: string[] = [
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ...(process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : []),
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  plugins: [
    admin(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          // Guard: never log OTP codes in production — this is a 2FA secret
          if (process.env.NODE_ENV !== "production") {
            console.log(`[DEV] Send OTP to ${user.email}: ${otp}`);
          }
          // TODO: wire up real email sender for production OTP delivery
          // await sendOtpEmail(user.email, otp);
        },
      },
    }),
  ],

  // ── Email + Password ────────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification is runtime-controlled via configSystem.requireEmailVerification.
    // Phase 4 will set this to true and add an after-signup auto-verify hook.
    requireEmailVerification: false,
  },

  // ── Google OAuth ────────────────────────────────────────────────────────────
  // Leave GOOGLE_CLIENT_ID empty to disable Google sign-in gracefully
  ...(process.env.GOOGLE_CLIENT_ID && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  }),

  // ── Session ─────────────────────────────────────────────────────────────────
  session: {
    expiresIn:  60 * 60 * 24 * 7,    // 7 days (was 30 — reduced for security)
    updateAge:  60 * 60 * 24,         // refresh token if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                 // cache cookie validation for 5 min
    },
  },

  // ── Security ─────────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,

  // ── Trusted origins (CORS) ────────────────────────────────────────────────
  // Wildcard patterns are NOT supported — list origins explicitly.
  // Use TRUSTED_ORIGINS env var for additional origins (e.g. LAN IPs for dev).
  trustedOrigins,
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
