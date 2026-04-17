/**
 * src/lib/session.ts
 * Client-side session utilities — device detection, session ID management, heartbeat.
 * Zero-knowledge: no vault keys or master passwords are used here.
 */

const SESSION_ID_KEY = "vaultr_session_id";

// ── Session ID helpers ────────────────────────────────────────────────────────

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_ID_KEY);
}

export function setSessionId(id: string): void {
  if (typeof window !== "undefined") localStorage.setItem(SESSION_ID_KEY, id);
}

/**
 * Removes the session ID from localStorage.
 * Called when the session is remotely revoked so that, if the user logs back in
 * on this device, a fresh session ID is generated instead of re-using the revoked one.
 */
export function clearSessionId(): void {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_ID_KEY);
}

export function generateSessionId(): string {
  const id = crypto.randomUUID();
  setSessionId(id);
  return id;
}

export function getOrCreateSessionId(): string {
  return getSessionId() ?? generateSessionId();
}

// ── Device detection ──────────────────────────────────────────────────────────

export type DeviceType = "desktop" | "mobile" | "tablet";

export interface DeviceInfo {
  deviceName: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
}

export function detectDevice(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  // OS
  let os = "Unknown OS";
  if (/Windows NT 10/.test(ua)) os = "Windows 11/10";
  else if (/Windows NT 6\.1/.test(ua)) os = "Windows 7";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X ([\d_]+)/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
  } else if (/iPhone OS ([\d_]+)/.test(ua)) {
    const m = ua.match(/iPhone OS ([\d_]+)/);
    os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
  } else if (/Android ([\d.]+)/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/CrOS/.test(ua)) os = "Chrome OS";
  else if (/Linux/.test(ua)) os = "Linux";

  // Browser
  let browser = "Unknown Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Chromium\//.test(ua)) browser = "Chromium";

  // Device type
  let deviceType: DeviceType = "desktop";
  if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) deviceType = "mobile";
  else if (/iPad|Android(?!.*Mobile)/.test(ua)) deviceType = "tablet";

  return {
    deviceName: `${browser} on ${os}`,
    deviceType,
    browser,
    os,
  };
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export interface HeartbeatOptions {
  uid: string;
  sessionId: string;
  /** Fresh Firebase ID token. The heartbeat re-fetches this on each tick via getToken(). */
  getToken: () => Promise<string | null>;
  /**
   * Called immediately when the heartbeat detects that this session has been
   * revoked by another device or an admin. The caller should sign the user out.
   */
  onRevoked: () => void;
}

export function startHeartbeat(opts: HeartbeatOptions): void {
  stopHeartbeat();
  void opts.uid; // suppress unused-var lint

  const tick = async () => {
    try {
      const token = await opts.getToken();
      if (!token) return; // token gone — auth is already resolving a signout

      const res = await fetch("/api/auth/session-heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: opts.sessionId }),
      });

      if (!res.ok) return; // network/server error — stay silent, try again next tick

      const data: { ok: boolean; revoked: boolean } = await res.json();

      if (data.revoked) {
        // This session was deleted remotely — force immediate logout.
        stopHeartbeat();
        clearSessionId(); // prevent ghost session on next login
        opts.onRevoked();
      }
    } catch {
      // Network failure — remain silent; next tick will retry.
    }
  };

  tick(); // immediate first beat
  _heartbeatTimer = setInterval(tick, 5 * 60 * 1000); // every 5 min
}

export function stopHeartbeat(): void {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}
