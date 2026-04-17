"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, getDoc, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import {
  getSessionId,
  getOrCreateSessionId,
  clearSessionId,
  detectDevice,
  startHeartbeat,
  stopHeartbeat,
} from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  sessionId: string;
  deviceName: string;
  deviceType: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  createdAt: string;
  lastSeenAt: string;
  isTrusted: boolean;
  isCurrentDevice: boolean;
}

export interface SessionManagerState {
  sessions: Session[];
  currentSessionId: string | null;
  isVerified: boolean;
  /** True when the device is unverified AND requireVerificationOnNew is enabled — gate shows */
  needsDeviceGate: boolean;
  loading: boolean;
  sendingCode: boolean;
  verifying: boolean;
  revoking: Set<string>;
  otpError: string;
  otpSuccess: boolean;
  /** True when the server auto-sent an OTP during registration (requireVerificationOnNew = true) */
  autoVerificationTriggered: boolean;
  /** True only if the auto-OTP email was actually delivered */
  autoVerificationEmailSent: boolean;
  sendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<{ ok: boolean; error?: string }>;
  revokeSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
  revokeAllOtherSessions: () => Promise<{ ok: boolean; error?: string }>;
  clearOtpState: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSessionManager(uid: string | null): SessionManagerState {
  const [sessions, setSessions] = useState<Session[]>([]);
  // Two-part loading: wait for BOTH the sessions snapshot AND security prefs to resolve
  // so the vault page never flashes the wrong screen (gate vs master password).
  const [snapsLoaded, setSnapsLoaded] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [requireVerificationOnNew, setRequireVerificationOnNew] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [autoVerificationTriggered, setAutoVerificationTriggered] = useState(false);
  const [autoVerificationEmailSent, setAutoVerificationEmailSent] = useState(false);
  const bootstrapped = useRef(false);

  const currentSessionId = getSessionId();

  // ── ID token helper (always returns a fresh token) ────────────────────────
  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    try {
      return await auth.currentUser?.getIdToken(forceRefresh) ?? null;
    } catch {
      return null;
    }
  }, []);

  // ── Realtime Firestore listener ───────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      // No user — mark both as loaded so loading = false
      setSnapsLoaded(true);
      setPrefsLoaded(true);
      return;
    }

    const q = query(collection(db, "users", uid, "sessions"), orderBy("lastSeenAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        const curId = getSessionId();
        setSessions(snap.docs.map((d) => {
          const data = d.data();
          return {
            sessionId: d.id,
            deviceName: data.deviceName ?? "Unknown Device",
            deviceType: data.deviceType ?? "desktop",
            browser: data.browser ?? "Unknown",
            os: data.os ?? "Unknown",
            ipAddress: data.ipAddress ?? "",
            location: data.location ?? "",
            createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
            lastSeenAt: data.lastSeenAt?.toDate?.().toISOString() ?? new Date().toISOString(),
            isTrusted: data.isTrusted ?? false,
            isCurrentDevice: d.id === curId,
          };
        }));
        setSnapsLoaded(true);
      },
      () => setSnapsLoaded(true)
    );
    return () => unsub();
  }, [uid]);

  // ── Bootstrap: register session + read security prefs + start heartbeat ───
  useEffect(() => {
    if (!uid || bootstrapped.current) return;
    bootstrapped.current = true;

    // Read requireVerificationOnNew pref — must resolve before gate is shown
    getDoc(doc(db, "users", uid, "profile", "security"))
      .then((snap) => {
        setRequireVerificationOnNew(snap.data()?.requireVerificationOnNew === true);
      })
      .catch(() => { /* silent — pref stays false (safe default) */ })
      .finally(() => setPrefsLoaded(true));

    (async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const idToken = await currentUser.getIdToken();
        const sessionId = getOrCreateSessionId();
        const device = detectDevice();

        const res = await fetch("/api/auth/register-session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId, ...device }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.verificationRequired) {
            setAutoVerificationTriggered(true);
            setAutoVerificationEmailSent(data.verificationEmailSent === true);
          }
        }

        // ── Start heartbeat with revocation detection ──────────────────────
        // onRevoked fires when the server reports this session's doc was deleted.
        startHeartbeat({
          uid,
          sessionId,
          getToken: () => getIdToken(),
          onRevoked: () => {
            // Session was remotely revoked — force full signout immediately.
            stopHeartbeat();
            clearSessionId();
            signOut(auth).catch(() => {
              // If signOut fails (e.g. network), force redirect so the user
              // is not stuck in an indeterminate state.
              window.location.replace("/");
            });
          },
        });
      } catch { /* silent – never block vault */ }
    })();

    return () => stopHeartbeat();
  }, [uid, getIdToken]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const loading = !snapsLoaded || !prefsLoaded;
  const currentSession = sessions.find((s) => s.isCurrentDevice);
  const isVerified = currentSession?.isTrusted ?? false;
  // Gate = device unverified AND the user has opted into mandatory verification
  const needsDeviceGate = !isVerified && requireVerificationOnNew;

  // ── sendVerificationEmail ─────────────────────────────────────────────────
  const sendVerificationEmail = useCallback(async () => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    const idToken = await getIdToken();
    if (!idToken) return { ok: false, error: "Session expired — please reload" };

    setSendingCode(true); setOtpError("");
    try {
      const sessionId = getSessionId();
      const { deviceName } = detectDevice();
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId, deviceName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Failed to send code");
        return { ok: false, error: data.error };
      }
      return { ok: true };
    } finally { setSendingCode(false); }
  }, [uid, getIdToken]);

  // ── verifyOtp ─────────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (otp: string) => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    const idToken = await getIdToken();
    if (!idToken) return { ok: false, error: "Session expired" };

    setVerifying(true); setOtpError("");
    try {
      const sessionId = getSessionId();
      const res = await fetch("/api/auth/verify-device", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Verification failed");
        return { ok: false, error: data.error };
      }

      // Optimistically update client-side Firestore
      if (sessionId) {
        await setDoc(doc(db, "users", uid, "sessions", sessionId), { isTrusted: true }, { merge: true });
      }
      setOtpSuccess(true);
      return { ok: true };
    } finally { setVerifying(false); }
  }, [uid, getIdToken]);

  // ── revokeSession ─────────────────────────────────────────────────────────
  const revokeSession = useCallback(async (sessionIdToRevoke: string) => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    const idToken = await getIdToken();
    if (!idToken) return { ok: false, error: "Session expired" };

    setRevoking((p) => new Set(p).add(sessionIdToRevoke));
    try {
      const res = await fetch("/api/auth/revoke-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: sessionIdToRevoke }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };

      if (sessionIdToRevoke === currentSessionId) {
        // Revoking own current session → sign out immediately, no token refresh needed
        stopHeartbeat();
        clearSessionId();
        await signOut(auth);
      } else if (data.needsTokenRefresh) {
        // We revoked another session but revokeRefreshTokens is user-scoped —
        // force-refresh our own ID token so we don't get 401'd on next request.
        await getIdToken(true);
      }

      return { ok: true };
    } finally {
      setRevoking((p) => { const n = new Set(p); n.delete(sessionIdToRevoke); return n; });
    }
  }, [uid, currentSessionId, getIdToken]);

  // ── revokeAllOtherSessions ────────────────────────────────────────────────
  const revokeAllOtherSessions = useCallback(async () => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    const idToken = await getIdToken();
    if (!idToken) return { ok: false, error: "Session expired" };

    const res = await fetch("/api/auth/revoke-session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ currentSessionId }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };

    if (data.needsTokenRefresh) {
      // revokeRefreshTokens was called server-side — our own token is now past
      // the revocation timestamp. Force-refresh immediately so subsequent API
      // calls (including the next heartbeat) succeed.
      await getIdToken(true);
    }

    return { ok: true };
  }, [uid, currentSessionId, getIdToken]);

  const clearOtpState = useCallback(() => { setOtpError(""); setOtpSuccess(false); }, []);

  return {
    sessions, currentSessionId, isVerified, needsDeviceGate, loading,
    sendingCode, verifying, revoking, otpError, otpSuccess,
    autoVerificationTriggered, autoVerificationEmailSent,
    sendVerificationEmail, verifyOtp, revokeSession, revokeAllOtherSessions, clearOtpState,
  };
}
