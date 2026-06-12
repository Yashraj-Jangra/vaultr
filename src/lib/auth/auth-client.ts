/**
 * src/lib/auth/auth-client.ts
 *
 * Better Auth browser client.
 * Import this in client components and hooks — it is safe for the browser.
 */

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    adminClient(),
    twoFactorClient(),
  ],
});

// Re-export the hooks and helpers for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
