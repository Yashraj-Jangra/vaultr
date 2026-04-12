"use client";

/**
 * useVaultSession
 *
 * Persists the vault unlock state across page navigations and refreshes
 * within the same browser tab session (sessionStorage — cleared when tab closes).
 *
 * The raw master password is cached in sessionStorage so the key can be
 * silently re-derived on remount without prompting the user again.
 * This is equivalent to the in-session caching used by most password managers.
 */

const SESSION_KEY_PREFIX = "vaultr_session_";

export interface VaultSession {
  masterPassword: string;
  unlockedAt: number; // Unix ms timestamp
}

function sessionKey(uid: string) {
  return `${SESSION_KEY_PREFIX}${uid}`;
}

/** Save the unlock session. */
export function saveVaultSession(uid: string, masterPassword: string): void {
  if (typeof window === "undefined") return;
  const data: VaultSession = {
    masterPassword,
    unlockedAt: Date.now(),
  };
  sessionStorage.setItem(sessionKey(uid), JSON.stringify(data));
}

/** Load and validate the session. Returns null if expired or missing. */
export function loadVaultSession(
  uid: string,
  timeoutMinutes: number
): VaultSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(uid));
    if (!raw) return null;
    const data: VaultSession = JSON.parse(raw);

    // If timeout is 0, session never expires (until tab close)
    if (timeoutMinutes > 0) {
      const ageMs = Date.now() - data.unlockedAt;
      const maxMs = timeoutMinutes * 60 * 1000;
      if (ageMs > maxMs) {
        clearVaultSession(uid);
        return null;
      }
    }

    return data;
  } catch {
    return null;
  }
}

/** Refresh the "last active" timestamp on the session. */
export function refreshVaultSession(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(sessionKey(uid));
    if (!raw) return;
    const data: VaultSession = JSON.parse(raw);
    data.unlockedAt = Date.now();
    sessionStorage.setItem(sessionKey(uid), JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Remove the session (on lock or sign-out). */
export function clearVaultSession(uid: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(sessionKey(uid));
}
