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

// ── Trusted Origins ──────────────────────────────────────────────────────────
async function getTrustedOrigins(): Promise<string[]> {
  const origins: string[] = [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    ...(process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : []),
  ];

  return Array.from(new Set(origins));
}

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
            const { sendTemplatedEmail } = await import("@/lib/emailTemplates");
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
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      try {
        const { sendTemplatedEmail } = await import("@/lib/emailTemplates");
        await sendTemplatedEmail({
          templateKey: "password_reset",
          to: user.email,
          vars: {
            RESET_URL: url,
            USER_EMAIL: user.email,
          },
        });
      } catch (err) {
        console.error("[BetterAuth] Failed to send reset password email:", err);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${user.email}: ${url}`);
        }
      }
    },
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
        const { sendTemplatedEmail } = await import("@/lib/emailTemplates");
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
    // cookieCache disabled to ensure instant cross-device session revocation
    cookieCache: {
      enabled: false,
    },
  },

  // ── Security ─────────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,

  // ── Trusted origins (CORS) ────────────────────────────────────────────────
  trustedOrigins: getTrustedOrigins,
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
