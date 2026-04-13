"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import {
  getSessionId,
  getOrCreateSessionId,
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
  loading: boolean;
  sendingCode: boolean;
  verifying: boolean;
  revoking: Set<string>;
  otpError: string;
  otpSuccess: boolean;
  sendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<{ ok: boolean; error?: string }>;
  revokeSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
  revokeAllOtherSessions: () => Promise<{ ok: boolean; error?: string }>;
  clearOtpState: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSessionManager(uid: string | null): SessionManagerState {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);
  const bootstrapped = useRef(false);

  const currentSessionId = getSessionId();

  // ── Realtime Firestore listener
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

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
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid]);

  // ── Bootstrap: register session + start heartbeat
  useEffect(() => {
    if (!uid || bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const idToken = await currentUser.getIdToken();
        const sessionId = getOrCreateSessionId();
        const device = detectDevice();

        await fetch("/api/auth/register-session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId, ...device }),
        });

        startHeartbeat(uid, sessionId, idToken);
      } catch { /* silent – never block vault */ }
    })();

    return () => stopHeartbeat();
  }, [uid]);

  // ── Derived
  const currentSession = sessions.find((s) => s.isCurrentDevice);
  const isVerified = currentSession?.isTrusted ?? false;

  // ── ID token helper
  const getIdToken = useCallback(async () => {
    try { return await auth.currentUser?.getIdToken() ?? null; } catch { return null; }
  }, []);

  // ── sendVerificationEmail
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
      if (!res.ok) { setOtpError(data.error ?? "Failed to send code"); return { ok: false, error: data.error }; }
      return { ok: true };
    } finally { setSendingCode(false); }
  }, [uid, getIdToken]);

  // ── verifyOtp
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
      if (!res.ok) { setOtpError(data.error ?? "Verification failed"); return { ok: false, error: data.error }; }

      // Optimistically update client-side Firestore
      if (sessionId) {
        await setDoc(doc(db, "users", uid, "sessions", sessionId), { isTrusted: true }, { merge: true });
      }
      setOtpSuccess(true);
      return { ok: true };
    } finally { setVerifying(false); }
  }, [uid, getIdToken]);

  // ── revokeSession
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

      // If revoking own session → sign out
      if (sessionIdToRevoke === currentSessionId) {
        stopHeartbeat();
        await signOut(auth);
      }
      return { ok: true };
    } finally {
      setRevoking((p) => { const n = new Set(p); n.delete(sessionIdToRevoke); return n; });
    }
  }, [uid, currentSessionId, getIdToken]);

  // ── revokeAllOtherSessions
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
    return { ok: true };
  }, [uid, currentSessionId, getIdToken]);

  const clearOtpState = useCallback(() => { setOtpError(""); setOtpSuccess(false); }, []);

  return {
    sessions, currentSessionId, isVerified, loading,
    sendingCode, verifying, revoking, otpError, otpSuccess,
    sendVerificationEmail, verifyOtp, revokeSession, revokeAllOtherSessions, clearOtpState,
  };
}
