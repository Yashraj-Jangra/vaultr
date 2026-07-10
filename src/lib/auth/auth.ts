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

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  plugins: [
    admin(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          // This will be replaced with our actual email sending logic later
          console.log(`[DEV] Send OTP to ${user.email}: ${otp}`);
        }
      }
    }),
  ],

  // ── Email + Password ────────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // set to true if you want email verification on signup
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
    expiresIn:  60 * 60 * 24 * 30,   // 30 days
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
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "http://192.168.*",
    "http://192.168.*:*",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
