"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authClient } from "@/lib/auth/auth-client";
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
  needsDeviceGate: boolean;
  loading: boolean;
  sendingCode: boolean;
  verifying: boolean;
  revoking: Set<string>;
  otpError: string;
  otpSuccess: boolean;
  autoVerificationTriggered: boolean;
  autoVerificationEmailSent: boolean;
  sendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<{ ok: boolean; error?: string }>;
  revokeSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
  revokeAllOtherSessions: () => Promise<{ ok: boolean; error?: string }>;
  clearOtpState: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSessionManager(uid: string | null): SessionManagerState {
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [prefsLoaded,  setPrefsLoaded]  = useState(false);
  const [requireVerificationOnNew, setRequireVerificationOnNew] = useState(false);
  const [sendingCode,  setSendingCode]  = useState(false);
  const [verifying,    setVerifying]    = useState(false);
  const [revoking,     setRevoking]     = useState<Set<string>>(new Set());
  const [otpError,     setOtpError]     = useState("");
  const [otpSuccess,   setOtpSuccess]   = useState(false);
  const [autoVerificationTriggered, setAutoVerificationTriggered] = useState(false);
  const [autoVerificationEmailSent, setAutoVerificationEmailSent] = useState(false);
  const bootstrapped = useRef(false);
  const sseRef = useRef<EventSource | null>(null);

  const currentSessionId = getSessionId();

  // ── Better Auth session provides the token via cookie — no Bearer token needed
  //    API routes use verifyUserToken which reads the cookie automatically.
  //    This helper exists so startHeartbeat can pass a token; with cookie auth
  //    we return null (the heartbeat endpoint reads the cookie).
  const getToken = useCallback(async (): Promise<string | null> => null, []);

  // ── Fetch sessions list from REST API
  const fetchSessions = useCallback(async () => {
    if (!uid) return;
    try {
      const res = await fetch("/api/auth/sessions", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const curId = getSessionId();
      const list: Session[] = (data.sessions ?? []).map((row: Record<string, string | boolean>) => ({
        sessionId:       row.session_id ?? row.sessionId,
        deviceName:      row.device_name  ?? row.deviceName  ?? "Unknown Device",
        deviceType:      row.device_type  ?? row.deviceType  ?? "desktop",
        browser:         row.browser      ?? "Unknown",
        os:              row.os           ?? "Unknown",
        ipAddress:       row.ip_address   ?? row.ipAddress   ?? "",
        location:        row.location     ?? "",
        createdAt:       row.created_at   ?? row.createdAt   ?? new Date().toISOString(),
        lastSeenAt:      row.last_seen_at ?? row.lastSeenAt  ?? new Date().toISOString(),
        isTrusted:       row.is_trusted   ?? row.isTrusted   ?? false,
        isCurrentDevice: (row.session_id ?? row.sessionId) === curId,
      }));
      setSessions(list);
    } catch { /* silent */ }
    finally { setSessionsLoaded(true); }
  }, [uid]);

  // ── Subscribe via SSE for real-time session list updates
  useEffect(() => {
    if (!uid) {
      setSessionsLoaded(true);
      setPrefsLoaded(true);
      return;
    }

    fetchSessions();

    const es = new EventSource("/api/auth/sessions/stream", { withCredentials: true });
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "sessions_changed") fetchSessions();
      } catch { /* ignore */ }
    };
    return () => { es.close(); sseRef.current = null; };
  }, [uid, fetchSessions]);

  // ── Bootstrap: load security prefs + register session + start heartbeat
  useEffect(() => {
    if (!uid || bootstrapped.current) return;
    bootstrapped.current = true;

    // Load security prefs
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { requireVerificationOnNew?: boolean }) => {
        setRequireVerificationOnNew(data?.requireVerificationOnNew === true);
      })
      .catch(() => { /* safe default: false */ })
      .finally(() => setPrefsLoaded(true));

    // Register session + start heartbeat
    (async () => {
      try {
        const sessionId = getOrCreateSessionId();
        const device = detectDevice();

        const res = await fetch("/api/auth/register-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...device }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.verificationRequired) {
            setAutoVerificationTriggered(true);
            setAutoVerificationEmailSent(data.verificationEmailSent === true);
          }
        }

        startHeartbeat({
          uid,
          sessionId,
          getToken,
          onRevoked: () => {
            stopHeartbeat();
            clearSessionId();
            authClient.signOut().catch(() => window.location.replace("/"));
          },
        });
      } catch { /* silent — never block vault */ }
    })();

    return () => stopHeartbeat();
  }, [uid, getToken, fetchSessions]);

  // ── Derived state
  const loading = !sessionsLoaded || !prefsLoaded;
  const currentSession = sessions.find((s) => s.isCurrentDevice);
  const isVerified = currentSession?.isTrusted ?? false;
  const needsDeviceGate = !isVerified && requireVerificationOnNew;

  // ── sendVerificationEmail
  const sendVerificationEmail = useCallback(async () => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    setSendingCode(true); setOtpError("");
    try {
      const sessionId = getSessionId();
      const { deviceName } = detectDevice();
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, deviceName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Failed to send code");
        return { ok: false, error: data.error };
      }
      return { ok: true };
    } finally { setSendingCode(false); }
  }, [uid]);

  // ── verifyOtp
  const verifyOtp = useCallback(async (otp: string) => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    setVerifying(true); setOtpError("");
    try {
      const sessionId = getSessionId();
      const res = await fetch("/api/auth/verify-device", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Verification failed");
        return { ok: false, error: data.error };
      }
      // Optimistically update local state
      setSessions((prev) =>
        prev.map((s) => s.isCurrentDevice ? { ...s, isTrusted: true } : s)
      );
      setOtpSuccess(true);
      return { ok: true };
    } finally { setVerifying(false); }
  }, [uid]);

  // ── revokeSession
  const revokeSession = useCallback(async (sessionIdToRevoke: string) => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    setRevoking((p) => new Set(p).add(sessionIdToRevoke));
    try {
      const res = await fetch("/api/auth/revoke-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdToRevoke }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };

      if (sessionIdToRevoke === currentSessionId) {
        stopHeartbeat();
        clearSessionId();
        await authClient.signOut();
      }
      fetchSessions();
      return { ok: true };
    } finally {
      setRevoking((p) => { const n = new Set(p); n.delete(sessionIdToRevoke); return n; });
    }
  }, [uid, currentSessionId, fetchSessions]);

  // ── revokeAllOtherSessions
  const revokeAllOtherSessions = useCallback(async () => {
    if (!uid) return { ok: false, error: "Not authenticated" };
    const res = await fetch("/api/auth/revoke-session", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentSessionId }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    fetchSessions();
    return { ok: true };
  }, [uid, currentSessionId, fetchSessions]);

  const clearOtpState = useCallback(() => { setOtpError(""); setOtpSuccess(false); }, []);

  return {
    sessions, currentSessionId, isVerified, needsDeviceGate, loading,
    sendingCode, verifying, revoking, otpError, otpSuccess,
    autoVerificationTriggered, autoVerificationEmailSent,
    sendVerificationEmail, verifyOtp, revokeSession, revokeAllOtherSessions, clearOtpState,
  };
}
