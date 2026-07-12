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
import { user as userTable, configSystem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendTemplatedEmail } from "@/lib/emailTemplates";

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
          try {
            await sendTemplatedEmail({
              templateKey: "device_verification",
              to: user.email,
              vars: {
                OTP: otp,
                DEVICE_NAME: "Vaultr Secure Session",
              },
            });
          } catch (err) {
            console.error("Failed to send OTP email:", err);
          }
        },
      },
    }),
  ],

  // ── Email + Password ────────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // Always require email verification at the Better Auth level.
    // The admin panel toggle in configSystem.requireEmailVerification controls
    // whether new users are auto-verified immediately (toggle OFF) or must click
    // the email link (toggle ON). See the hooks section below.
    requireEmailVerification: true,
  },

  // ── Email Verification ───────────────────────────────────────────────────────
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      // Check the admin panel toggle from the database
      const [config] = await db
        .select({ requireEmailVerification: configSystem.requireEmailVerification })
        .from(configSystem)
        .where(eq(configSystem.id, 1))
        .limit(1);

      const required = config?.requireEmailVerification ?? false;

      if (!required) {
        // Toggle OFF: auto-verify the user immediately by marking them as verified
        // so they can sign in right away without any email interaction.
        await db
          .update(userTable)
          .set({ emailVerified: true })
          .where(eq(userTable.id, user.id));
        return;
      }

      // Toggle ON: send the real verification email.
      try {
        await sendTemplatedEmail({
          templateKey: "email_verification",
          to: user.email,
          vars: {
            VERIFICATION_URL: url,
          },
        });
      } catch (err) {
        console.error("Failed to send verification email:", err);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Email verification link for ${user.email}: ${url}`);
        }
      }
    },
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
