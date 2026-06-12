"use client";

/**
 * src/hooks/useFirebaseAuth.ts
 *
 * Auth hook — exposes identical API surface as the old Firebase version
 * so that all 30+ call sites across the app need zero changes.
 *
 * Internals now use Better Auth instead of Firebase Auth.
 *
 * API surface (unchanged):
 *   { user, isAdmin, isAdminLoading, isAuthLoading, isAuthenticating,
 *     error, login, register, googleLogin, resetPassword, logout }
 */

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth/auth-client";

// ─── Friendly error messages ──────────────────────────────────────────────────

function friendly(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: string }).message.toLowerCase();
    if (msg.includes("invalid email") || msg.includes("invalid credentials"))
      return "Incorrect email or password.";
    if (msg.includes("user not found"))
      return "No account with that email.";
    if (msg.includes("email already"))
      return "An account with this email already exists.";
    if (msg.includes("password"))
      return "Password must be at least 8 characters.";
    if (msg.includes("network") || msg.includes("fetch"))
      return "Network error — check your connection.";
  }
  return "Something went wrong. Try again.";
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Expose a shape compatible with what the rest of the app expects.
// Previously this was Firebase's User type — now we use Better Auth's user.
export interface AppUser {
  id: string;         // replaces Firebase's uid
  uid: string;        // alias for id — keeps old call sites working without changes
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFirebaseAuth = () => {
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [isAdmin,          setIsAdmin]          = useState(false);
  const [isAdminLoading,   setIsAdminLoading]   = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  // Map Better Auth session user → AppUser shape
  const user: AppUser | null = session?.user
    ? {
        id:          session.user.id,
        uid:         session.user.id,   // alias — keeps old code working
        email:       session.user.email ?? null,
        displayName: session.user.name  ?? null,
        photoURL:    session.user.image ?? null,
      }
    : null;

  const isAuthLoading = isSessionPending;

  // ── Check admin role whenever user changes ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }

    setIsAdminLoading(true);
    // Fetch admin status from our user_profiles table via API
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { role?: string }) => {
        setIsAdmin(data?.role === "admin");
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setIsAdminLoading(false));
  }, [user?.id]);

  // ── Auth actions ────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, pass: string) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email, password: pass });
      if (result.error) setError(friendly(result.error));
    } catch (err) {
      setError(friendly(err));
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, pass: string, firstName?: string, _username?: string) => {
      setIsAuthenticating(true);
      setError(null);
      try {
        const result = await authClient.signUp.email({
          email,
          password: pass,
          name: firstName ?? "",
        });
        if (result.error) setError(friendly(result.error));
      } catch (err) {
        setError(friendly(err));
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const googleLogin = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      // Better Auth uses redirect for OAuth — this will navigate away then return
      await authClient.signIn.social({ provider: "google" });
    } catch (err) {
      setError(friendly(err));
      setIsAuthenticating(false);
    }
    // Note: setIsAuthenticating(false) not needed here — page will redirect
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });
      if (result.error) {
        setError(friendly(result.error));
        return false;
      }
      return true;
    } catch (err) {
      setError(friendly(err));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await authClient.signOut();
  }, []);

  return {
    user,
    isAdmin,
    isAdminLoading,
    isAuthLoading,
    isAuthenticating,
    error,
    login,
    register,
    googleLogin,
    resetPassword,
    logout,
  };
};
