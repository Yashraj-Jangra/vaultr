import React, { useState, useEffect } from "react";
import {
  Lock,
  Info,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  BookOpen,
  History,
  Shield,
  ShieldCheck,
  LifeBuoy,
  FileText,
  Globe,
  Fingerprint,
  KeyRound,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Trash2,
  RefreshCw,
  Clock,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { AccountInfo, resolveAvatarUrl } from "./App";
import {
  VAULTR_EDITION,
  VAULTR_VERSION,
  VAULTR_BUILD_NUMBER,
  VAULTR_CRYPTO_SPEC,
  isPlatformAuthenticatorAvailable,
  enrollBiometricUnlock,
} from "@vaultr/core";

interface SettingsScreenProps {
  serverUrl: string;
  accountInfo: AccountInfo;
  onUpdateServerUrl: (url: string) => Promise<void>;
  onLock: () => void;
}

interface SessionData {
  sessionId: string;
  isCurrent: boolean;
  deviceName: string;
  browser: string;
  os: string;
  isMobile?: boolean;
  clientType?: "mobile_app" | "mobile_browser" | "desktop_web";
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  expiresAt: string;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return "—";
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function PasswordField({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          height: 36,
          fontSize: 12,
          paddingRight: 32,
          background: "#0d0d0d",
          borderRadius: 8,
          fontFamily: show ? "inherit" : "monospace",
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "var(--neutral-500)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

export function SettingsScreen({ serverUrl, accountInfo, onUpdateServerUrl, onLock }: SettingsScreenProps) {
  const [url, setUrl] = useState(serverUrl);
  const [saved, setSaved] = useState(false);
  
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [subdomainMatching, setSubdomainMatching] = useState(true);
  const [autofillSubmit, setAutofillSubmit] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState("15");

  const [browserOverrideActive, setBrowserOverrideActive] = useState(false);
  const [browserOverrideSupported, setBrowserOverrideSupported] = useState(true);
  const [autoCopy2fa, setAutoCopy2fa] = useState(true);

  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);
  const [bioEnrolling, setBioEnrolling] = useState(false);
  const [bioError, setBioError] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [promptPassword, setPromptPassword] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEdgeBrowser, setIsEdgeBrowser] = useState(() => {
    return typeof navigator !== "undefined" && /Edg\//i.test(navigator.userAgent);
  });

  // Change Master Password state
  const [showChangePw, setShowChangePw] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Sessions & Devices state
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        [
          "autofill_enabled",
          "vaultr_subdomain_matching",
          "autofill_submit",
          "autolock_minutes",
          "vaultr_passkeys_enabled",
          "vaultr_biometric_enrolled",
          "vaultr_default_manager",
          "vaultr_autocopy_2fa",
        ],
        async (res) => {
          if (res.autofill_enabled !== undefined) setAutofillEnabled(res.autofill_enabled);
          if (res.vaultr_subdomain_matching !== undefined) setSubdomainMatching(res.vaultr_subdomain_matching !== false);
          if (res.autofill_submit !== undefined) setAutofillSubmit(res.autofill_submit);
          if (res.autolock_minutes !== undefined) setAutoLockMinutes(res.autolock_minutes);
          if (res.vaultr_passkeys_enabled !== undefined) setPasskeysEnabled(res.vaultr_passkeys_enabled);
          if (res.vaultr_biometric_enrolled !== undefined) setBiometricsEnrolled(res.vaultr_biometric_enrolled);
          if (res.vaultr_default_manager !== undefined) setBrowserOverrideActive(res.vaultr_default_manager);
          if (res.vaultr_autocopy_2fa !== undefined) setAutoCopy2fa(res.vaultr_autocopy_2fa);

          const avail = await isPlatformAuthenticatorAvailable();
          setBiometricsSupported(avail);
        }
      );

      if (chrome.runtime) {
        chrome.runtime.sendMessage({ type: "GET_BROWSER_OVERRIDE_STATUS" }, (status) => {
          if (chrome.runtime.lastError) return;
          if (status) {
            setBrowserOverrideSupported(status.supported !== false);
            if (status.isControlled !== undefined) {
              setBrowserOverrideActive(status.isControlled);
            }
            if (status.isEdge !== undefined) {
              setIsEdgeBrowser(status.isEdge);
            }
          }
        });
      }
    }
  }, []);

  const handleToggleBrowserOverride = (enabled: boolean) => {
    setBrowserOverrideActive(enabled);
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "SET_BROWSER_OVERRIDE", enabled }, (res) => {
        if (res?.isControlled !== undefined) {
          setBrowserOverrideActive(res.isControlled);
        }
      });
    }
  };

  const handleToggleAutoCopy2fa = (enabled: boolean) => {
    setAutoCopy2fa(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ vaultr_autocopy_2fa: enabled });
    }
  };

  const handleToggleAutofill = (enabled: boolean) => {
    setAutofillEnabled(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ autofill_enabled: enabled });
    }
  };

  const handleToggleSubdomainMatching = (enabled: boolean) => {
    setSubdomainMatching(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ vaultr_subdomain_matching: enabled });
    }
  };

  const handleToggleSubmit = (enabled: boolean) => {
    setAutofillSubmit(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ autofill_submit: enabled });
    }
  };

  const handleTogglePasskeys = (enabled: boolean) => {
    setPasskeysEnabled(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ vaultr_passkeys_enabled: enabled });
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    setBioError("");
    if (!enabled) {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.remove(["vaultr_biometric_enrolled", "vaultr_biometric_blob"]);
      }
      setBiometricsEnrolled(false);
      return;
    }

    let pw = "";
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      const sess = await chrome.storage.session.get("vaultr_master_password");
      pw = sess?.vaultr_master_password || "";
    }

    if (!pw) {
      setShowPasswordPrompt(true);
      return;
    }

    await executeBiometricEnrollment(pw);
  };

  const executeBiometricEnrollment = async (password: string) => {
    setBioEnrolling(true);
    setBioError("");
    try {
      const blob = await enrollBiometricUnlock(password);
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({
          vaultr_biometric_enrolled: true,
          vaultr_biometric_blob: blob,
        });
      }
      setBiometricsEnrolled(true);
      setShowPasswordPrompt(false);
      setPromptPassword("");
    } catch (err: any) {
      setBioError(err?.message || "Biometric enrollment failed");
    } finally {
      setBioEnrolling(false);
    }
  };

  const handleChangeMasterPassword = async () => {
    setPwMsg(null);
    if (!oldPw || !newPw || !confirmPw) {
      setPwMsg({ text: "Please fill in all password fields.", ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New master passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: "New master password must be at least 8 characters.", ok: false });
      return;
    }
    if (oldPw === newPw) {
      setPwMsg({ text: "New master password must differ from current master password.", ok: false });
      return;
    }

    setPwChanging(true);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        {
          type: "CHANGE_MASTER_PASSWORD",
          oldPassword: oldPw,
          newPassword: newPw,
        },
        (res) => {
          setPwChanging(false);
          if (chrome.runtime.lastError) {
            setPwMsg({
              text: chrome.runtime.lastError.message || "Failed to communicate with background service.",
              ok: false,
            });
            return;
          }
          if (res?.error) {
            setPwMsg({ text: res.error, ok: false });
          } else {
            setPwMsg({
              text: `Master password changed. ${res.count ?? 0} item(s) re-encrypted.`,
              ok: true,
            });
            setOldPw("");
            setNewPw("");
            setConfirmPw("");
            setBiometricsEnrolled(false);
          }
        }
      );
    } else {
      setPwChanging(false);
      setPwMsg({ text: "Extension runtime not available.", ok: false });
    }
  };

  const handleAutolockChange = (val: string) => {
    setAutoLockMinutes(val);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ autolock_minutes: val });
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "SET_AUTO_LOCK", minutes: val });
    }
  };

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const openSite = (path = "") => {
    const base = serverUrl.replace(/\/+$/, "");
    const target = `${base}${path}`;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: target });
    } else {
      window.open(target, "_blank");
    }
  };

  const loadSessions = async () => {
    const base = (serverUrl || "").replace(/\/+$/, "");
    if (!base) return;
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await fetch(`${base}/api/settings/sessions`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error("Failed to load sessions");
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err: any) {
      setSessionsError(err.message || "Could not load sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const base = (serverUrl || "").replace(/\/+$/, "");
    if (!base) return;
    setRevokingId(sessionId);
    setSessionsError("");
    try {
      const res = await fetch(`${base}/api/settings/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to revoke session");
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err: any) {
      setSessionsError(err.message || "Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    const base = (serverUrl || "").replace(/\/+$/, "");
    if (!base) return;
    setConfirmRevokeAll(false);
    setRevokingAll(true);
    setSessionsError("");
    try {
      const res = await fetch(`${base}/api/settings/sessions`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to revoke other sessions");
      }
      await loadSessions();
    } catch (err: any) {
      setSessionsError(err.message || "Failed to sign out all other devices");
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  const renderSessionCard = (s: SessionData) => {
    const isMobileApp =
      s.clientType === "mobile_app" ||
      s.browser.toLowerCase().includes("vaultr mobile") ||
      s.deviceName.toLowerCase().includes("vaultr mobile");
    const isMobile =
      s.isMobile ||
      isMobileApp ||
      s.os.toLowerCase().includes("iphone") ||
      s.os.toLowerCase().includes("android") ||
      s.os.toLowerCase().includes("mobile");

    const isRevoking = revokingId === s.sessionId;
    const location = [s.city, s.country].filter(Boolean).join(", ");

    return (
      <div
        key={s.sessionId}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          background: s.isCurrent ? "rgba(16, 185, 129, 0.05)" : "#141416",
          border: s.isCurrent ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {/* Device Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: s.isCurrent
              ? "rgba(16, 185, 129, 0.15)"
              : isMobileApp
              ? "rgba(167, 139, 250, 0.15)"
              : isMobile
              ? "rgba(251, 191, 36, 0.15)"
              : "rgba(255, 255, 255, 0.05)",
          }}
        >
          {isMobile ? (
            <Smartphone
              size={16}
              style={{
                color: s.isCurrent ? "#34d399" : isMobileApp ? "#a78bfa" : "#fbbf24",
              }}
            />
          ) : (
            <Monitor
              size={16}
              style={{
                color: s.isCurrent ? "#34d399" : "var(--neutral-400)",
              }}
            />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: s.isCurrent ? "#6ee7b7" : "var(--neutral-200)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 160,
              }}
              title={s.deviceName}
            >
              {s.deviceName}
            </span>

            {s.isCurrent && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ShieldCheck size={9} /> THIS DEVICE
              </span>
            )}

            {isMobileApp ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(167, 139, 250, 0.15)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Smartphone size={9} /> MOBILE APP
              </span>
            ) : isMobile ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(251, 191, 36, 0.15)",
                  color: "#fcd34d",
                  border: "1px solid rgba(251, 191, 36, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Smartphone size={9} /> MOBILE BROWSER
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#a3a3a3",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Monitor size={9} /> DESKTOP WEB
              </span>
            )}

            {isMobileApp ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Fingerprint size={9} /> BIOMETRICS
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ShieldCheck size={9} /> WINDOWS HELLO
              </span>
            )}
          </div>

          {/* Sub metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            {s.ipAddress && (
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "monospace",
                  color: "var(--neutral-400)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Globe size={10} style={{ color: "var(--neutral-500)" }} />
                {s.ipAddress}
              </span>
            )}
            <span
              style={{
                fontSize: 10.5,
                color: "var(--neutral-500)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Clock size={10} style={{ color: "var(--neutral-600)" }} />
              Active {relativeTime(s.lastActiveAt ?? s.createdAt)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10,
                color: "var(--neutral-600)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <LogIn size={10} />
              Signed in {formatDate(s.createdAt)}
            </span>
            {location && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--neutral-500)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 130,
                }}
                title={location}
              >
                · {location}
              </span>
            )}
          </div>
        </div>

        {/* Revoke button */}
        {!s.isCurrent && (
          <button
            type="button"
            disabled={isRevoking || revokingAll}
            onClick={() => handleRevokeSession(s.sessionId)}
            style={{
              background: "none",
              border: "none",
              color: "#f87171",
              fontSize: 10.5,
              fontWeight: 500,
              cursor: isRevoking || revokingAll ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "3px 6px",
              borderRadius: 5,
              flexShrink: 0,
              opacity: isRevoking ? 0.6 : 1,
            }}
            title="Revoke session"
          >
            {isRevoking ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            {isRevoking ? "Revoking…" : "Revoke"}
          </button>
        )}
      </div>
    );
  };

  const initials = accountInfo.name
    ? accountInfo.name.slice(0, 2).toUpperCase()
    : accountInfo.email
    ? accountInfo.email.slice(0, 2).toUpperCase()
    : "VA";

  return (
    <div className="screen-body" style={{ padding: "8px 16px" }}>

      {/* Account Info - Circular Profile Avatar & Manage Account Button */}
      <div className="settings-section">
        <div className="settings-section-title">ACCOUNT</div>
        <div
          onClick={() => openSite("/settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "8px 4px",
            cursor: "pointer"
          }}
        >
          {resolveAvatarUrl(accountInfo.image || (accountInfo as any).avatarUrl, serverUrl) ? (
            <img
              src={resolveAvatarUrl(accountInfo.image || (accountInfo as any).avatarUrl, serverUrl)!}
              alt=""
              style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }}
            />
          ) : (
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#1c1c1e",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--neutral-200)",
                flexShrink: 0,
                letterSpacing: "-0.5px"
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="account-name" style={{ fontSize: 14, fontWeight: 600, color: "var(--neutral-100)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {accountInfo.name || accountInfo.email || "Vaultr User"}
            </div>
            {accountInfo.email && (
              <div className="account-email" style={{ fontSize: 12, color: "var(--neutral-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                {accountInfo.email}
              </div>
            )}
          </div>
          <ChevronRight size={16} style={{ color: "var(--neutral-600)", flexShrink: 0 }} />
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", height: 36, justifyContent: "center", fontSize: 12, borderRadius: 10, marginTop: 10 }}
          onClick={() => openSite("/settings")}
        >
          <ExternalLink size={13} style={{ marginRight: 4 }} />
          Manage Account on Vaultr
        </button>
      </div>

      {/* Passkeys & Hardware Security */}
      <div className="settings-section">
        <div className="settings-section-title">PASSKEYS & HARDWARE SECURITY</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Save and fill passkeys</div>
            <div className="settings-row-sub">VaultR acts as browser passkey provider</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={passkeysEnabled}
              onChange={(e) => handleTogglePasskeys(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Set as Default Passkey Provider card */}
        <div style={{ marginTop: 10, padding: "10px 12px", background: "#0d0d0d", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-200)", display: "flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={13} style={{ color: "#38bdf8" }} />
              Default Passkey Provider
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
              Active
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--neutral-500)", lineHeight: 1.4, margin: "4px 0 8px" }}>
            To configure VaultR as default in Chrome or Edge, visit browser passkey settings:
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, height: 28, fontSize: 10, justifyContent: "center", gap: 4, padding: "0 8px" }}
              onClick={() => {
                navigator.clipboard.writeText("chrome://password-manager/settings");
                setCopiedKey("chrome_passkeys");
                setTimeout(() => setCopiedKey(null), 2000);
              }}
            >
              {copiedKey === "chrome_passkeys" ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
              {copiedKey === "chrome_passkeys" ? "Copied Chrome Link" : "Copy Chrome Link"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, height: 28, fontSize: 10, justifyContent: "center", gap: 4, padding: "0 8px" }}
              onClick={() => {
                navigator.clipboard.writeText("edge://settings/autofill/passwords/settings");
                setCopiedKey("edge_passkeys");
                setTimeout(() => setCopiedKey(null), 2000);
              }}
            >
              {copiedKey === "edge_passkeys" ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
              {copiedKey === "edge_passkeys" ? "Copied Edge Link" : "Copy Edge Link"}
            </button>
          </div>
        </div>

        {/* Biometric Unlock (Windows Hello / Touch ID) */}
        {biometricsSupported && (
          <div style={{ marginTop: 12 }}>
            <div className="settings-row">
              <div>
                <div className="settings-row-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Fingerprint size={13} style={{ color: "#34d399" }} />
                  Windows Hello / Touch ID
                </div>
                <div className="settings-row-sub">Quick biometric vault re-unlock</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={biometricsEnrolled}
                  disabled={bioEnrolling}
                  onChange={(e) => handleToggleBiometrics(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {bioEnrolling && (
              <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="spinner" style={{ width: 12, height: 12 }} />
                Authenticating with hardware device…
              </div>
            )}

            {bioError && (
              <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>
                {bioError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Password Prompt Modal for Biometrics Setup */}
      {showPasswordPrompt && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(6px)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#0d0d0d",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 18,
            width: "100%",
            maxWidth: 280,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Fingerprint size={18} style={{ color: "#34d399" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-100)" }}>Enable Biometric Unlock</div>
            </div>
            <p style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
              Enter your master password once to authorize Windows Hello / Touch ID unlock.
            </p>
            <input
              type="password"
              className="form-input"
              value={promptPassword}
              onChange={(e) => setPromptPassword(e.target.value)}
              placeholder="Master password"
              autoFocus
              style={{ width: "100%", height: 38, fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, height: 34, fontSize: 11, justifyContent: "center" }}
                onClick={() => { setShowPasswordPrompt(false); setPromptPassword(""); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, height: 34, fontSize: 11, justifyContent: "center" }}
                disabled={!promptPassword || bioEnrolling}
                onClick={() => executeBiometricEnrollment(promptPassword)}
              >
                {bioEnrolling ? "Verifying…" : "Authorize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browser Integration & Autofill Preferences */}
      <div className="settings-section">
        <div className="settings-section-title">BROWSER INTEGRATION & AUTOFILL</div>

        {/* Make VaultR Default Password Manager card */}
        {browserOverrideSupported && (
          <div
            style={{
              padding: "12px",
              background: "#0d0d0d",
              border: `1px solid ${browserOverrideActive ? "rgba(16, 185, 129, 0.4)" : "var(--border)"}`,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={14} style={{ color: browserOverrideActive ? "#10b981" : "#38bdf8" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                    Make VaultR Default Password Manager
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
                  {isEdgeBrowser
                    ? browserOverrideActive
                      ? "VaultR manages form autofill. On Microsoft Edge, Microsoft Wallet is kept active so Windows Hello passkeys continue working without conflict."
                      : "Suppress browser autofill popups and let VaultR seamlessly handle logins without breaking Windows Hello passkeys."
                    : browserOverrideActive
                    ? "VaultR is actively managing browser password saving. Native browser prompts are suppressed."
                    : "Turn off browser password prompts and let VaultR seamlessly autofill and manage logins."}
                </div>
              </div>
              <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
                <input
                  type="checkbox"
                  checked={browserOverrideActive}
                  onChange={(e) => handleToggleBrowserOverride(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {browserOverrideActive && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={12} style={{ color: "#10b981", flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#10b981" }}>
                  {isEdgeBrowser ? "MANAGING BROWSER AUTOFILL & PASSKEYS" : "MANAGING BROWSER PASSWORD SETTING"}
                </span>
              </div>
            )}

            {isEdgeBrowser && browserOverrideActive && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: "#18181b", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 10.5, color: "var(--neutral-400)", lineHeight: 1.4, margin: "0 0 6px" }}>
                  To silence Edge's &quot;Save password?&quot; banner without affecting Windows Hello passkeys, turn off &quot;Offer to save passwords&quot; in Edge:
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: "100%", height: 26, fontSize: 10, justifyContent: "center", gap: 4 }}
                  onClick={() => {
                    navigator.clipboard.writeText("edge://settings/autofill/passwords/settings");
                    setCopiedKey("edge_autofill");
                    setTimeout(() => setCopiedKey(null), 2000);
                  }}
                >
                  {copiedKey === "edge_autofill" ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
                  {copiedKey === "edge_autofill" ? "Copied edge://settings/autofill/passwords/settings" : "Copy edge://settings/autofill/passwords/settings link"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Suggest credentials</div>
            <div className="settings-row-sub">Show Vaultr dropdown on fields</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autofillEnabled}
              onChange={(e) => handleToggleAutofill(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row" style={{ marginTop: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="settings-row-label">Match base domain</div>
            <div className="settings-row-sub">Suggest credentials across all subdomains and paths of the base domain (e.g. login.example.com and example.com)</div>
          </div>
          <label className="toggle" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={subdomainMatching}
              onChange={(e) => handleToggleSubdomainMatching(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row" style={{ marginTop: 4 }}>
          <div>
            <div className="settings-row-label">Auto-copy 2FA code on fill</div>
            <div className="settings-row-sub">Copies one-time TOTP code to clipboard</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoCopy2fa}
              onChange={(e) => handleToggleAutoCopy2fa(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row" style={{ marginTop: 4 }}>
          <div>
            <div className="settings-row-label">Auto-submit form</div>
            <div className="settings-row-sub">Automatically submit form after fill</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autofillSubmit}
              onChange={(e) => handleToggleSubmit(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Keyboard Shortcuts & Context Menu */}
        <div style={{ marginTop: 10, padding: "10px 12px", background: "#0d0d0d", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", letterSpacing: "0.04em", marginBottom: 6, textTransform: "uppercase" }}>
            Keyboard Shortcuts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "var(--neutral-300)" }}>Autofill credentials</span>
              <kbd style={{ padding: "2px 6px", fontSize: 10.5, fontFamily: "monospace", background: "#1c1c1e", border: "1px solid var(--border)", borderRadius: 5, color: "var(--neutral-200)" }}>
                {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘ Shift L" : "Ctrl Shift L"}
              </kbd>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "var(--neutral-300)" }}>Copy 2FA code</span>
              <kbd style={{ padding: "2px 6px", fontSize: 10.5, fontFamily: "monospace", background: "#1c1c1e", border: "1px solid var(--border)", borderRadius: 5, color: "var(--neutral-200)" }}>
                {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘ Shift T" : "Ctrl Shift T"}
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Auto-Lock */}
      <div className="settings-section">
        <div className="settings-section-title">SECURITY & TIMEOUTS</div>

        {/* Sessions & Devices Card */}
        <div
          style={{
            padding: "12px",
            background: "#0d0d0d",
            border: "1px solid var(--border)",
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => {
              const next = !showSessions;
              setShowSessions(next);
              if (next && sessions.length === 0 && !sessionsLoading) {
                loadSessions();
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <ShieldCheck size={14} style={{ color: "#38bdf8", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                  Sessions & Devices
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.3 }}>
                  {sessions.length > 0
                    ? `${sessions.length} active session${sessions.length !== 1 ? "s" : ""}`
                    : "Manage active sign-ins & devices"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                height: 26,
                padding: "0 8px",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
                borderRadius: 6,
                color: "var(--neutral-300)",
                flexShrink: 0,
              }}
              onClick={(e) => {
                e.stopPropagation();
                const next = !showSessions;
                setShowSessions(next);
                if (next && sessions.length === 0 && !sessionsLoading) {
                  loadSessions();
                }
              }}
            >
              {showSessions ? "Hide" : "Show"}
              {showSessions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>

          {showSessions && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Action bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Sessions
                  </span>
                  <button
                    type="button"
                    onClick={loadSessions}
                    disabled={sessionsLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--neutral-500)",
                      cursor: sessionsLoading ? "not-allowed" : "pointer",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 4,
                    }}
                    title="Refresh sessions"
                  >
                    <RefreshCw size={11} className={sessionsLoading ? "animate-spin" : ""} />
                  </button>
                </div>

                {otherSessions.length > 0 && !confirmRevokeAll && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeAll(true)}
                    disabled={revokingAll}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      fontSize: 10.5,
                      fontWeight: 500,
                      cursor: revokingAll ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 4px",
                      borderRadius: 4,
                    }}
                  >
                    <Trash2 size={11} />
                    Sign out others ({otherSessions.length})
                  </button>
                )}
              </div>

              {/* Confirm revoke all dialog */}
              {confirmRevokeAll && (
                <div
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "rgba(239, 68, 68, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <p style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.4, margin: 0 }}>
                    Sign out from {otherSessions.length} other device{otherSessions.length !== 1 ? "s" : ""}?
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ flex: 1, height: 28, fontSize: 11, justifyContent: "center" }}
                      disabled={revokingAll}
                      onClick={handleRevokeAllSessions}
                    >
                      {revokingAll ? (
                        <>
                          <Loader2 size={11} className="animate-spin" style={{ marginRight: 4 }} />
                          Signing out…
                        </>
                      ) : (
                        "Yes, sign out all"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: 1, height: 28, fontSize: 11, justifyContent: "center" }}
                      onClick={() => setConfirmRevokeAll(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {sessionsError && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#f87171",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={12} style={{ flexShrink: 0 }} />
                  <span>{sessionsError}</span>
                </div>
              )}

              {/* Loading skeleton */}
              {sessionsLoading && sessions.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 48, borderRadius: 8, background: "#161618", opacity: 0.6 }} className="animate-pulse" />
                  <div style={{ height: 48, borderRadius: 8, background: "#161618", opacity: 0.4 }} className="animate-pulse" />
                </div>
              )}

              {/* Empty state */}
              {!sessionsLoading && sessions.length === 0 && !sessionsError && (
                <div style={{ textAlign: "center", padding: "14px 0", fontSize: 11, color: "var(--neutral-500)" }}>
                  No active sessions found.
                </div>
              )}

              {/* Session cards */}
              {currentSession && renderSessionCard(currentSession)}
              {otherSessions.map((s) => renderSessionCard(s))}
            </div>
          )}
        </div>

        {/* Change Master Password Card */}
        <div
          style={{
            padding: "12px",
            background: "#0d0d0d",
            border: "1px solid var(--border)",
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => {
              setShowChangePw(!showChangePw);
              setPwMsg(null);
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <KeyRound size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                  Change Master Password
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.3 }}>
                  Re-encrypt vault blobs with a new key
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                height: 26,
                padding: "0 8px",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
                borderRadius: 6,
                color: "var(--neutral-300)",
                flexShrink: 0,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowChangePw(!showChangePw);
                setPwMsg(null);
              }}
            >
              {showChangePw ? "Cancel" : "Change"}
              {showChangePw ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>

          {showChangePw && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <PasswordField
                value={oldPw}
                onChange={setOldPw}
                placeholder="Current master password"
                disabled={pwChanging}
              />
              <PasswordField
                value={newPw}
                onChange={setNewPw}
                placeholder="New master password (min 8 chars)"
                disabled={pwChanging}
              />
              <PasswordField
                value={confirmPw}
                onChange={setConfirmPw}
                placeholder="Confirm new master password"
                disabled={pwChanging}
              />

              {pwMsg && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: pwMsg.ok ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${pwMsg.ok ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                    color: pwMsg.ok ? "#10b981" : "#f87171",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {pwMsg.ok ? <Check size={12} /> : <Info size={12} />}
                  <span>{pwMsg.text}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, height: 32, fontSize: 11, justifyContent: "center" }}
                  disabled={pwChanging}
                  onClick={() => {
                    setShowChangePw(false);
                    setOldPw("");
                    setNewPw("");
                    setConfirmPw("");
                    setPwMsg(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, height: 32, fontSize: 11, justifyContent: "center", gap: 6 }}
                  disabled={pwChanging || !oldPw || !newPw || !confirmPw}
                  onClick={handleChangeMasterPassword}
                >
                  {pwChanging ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Re-encrypting…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-row" style={{ marginBottom: 12 }}>
          <div>
            <div className="settings-row-label">Auto-lock timeout</div>
            <div className="settings-row-sub">Lock vault automatically</div>
          </div>
          <select
            className="form-select"
            style={{ width: "auto", fontSize: 12, padding: "6px 10px", background: "#0d0d0d", borderRadius: 10 }}
            value={autoLockMinutes}
            onChange={(e) => handleAutolockChange(e.target.value)}
          >
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="browser_close">On browser close</option>
            <option value="device_logout">On device logout</option>
            <option value="0">Never</option>
          </select>
        </div>

        <button
          className="btn btn-danger"
          style={{ width: "100%", height: 38, justifyContent: "center", borderRadius: 10, fontSize: 12, fontWeight: 500 }}
          onClick={onLock}
        >
          <Lock size={13} style={{ marginRight: 4 }} />
          Lock Vault Now
        </button>
      </div>

      {/* Server Connection */}
      <div className="settings-section">
        <div className="settings-section-title">SERVER CONNECTION</div>
        <form onSubmit={handleSaveUrl}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <div className="server-input-row" style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://vaultr.yourdomain.com"
                style={{ flex: 1, height: 38, fontSize: 12, background: "#0d0d0d", borderRadius: 10 }}
              />
              <button
                type="submit"
                className={`btn btn-primary${saved ? " btn-success" : ""}`}
                style={{ height: 38, padding: "0 14px", borderRadius: 10, fontSize: 12 }}
              >
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </form>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", height: 36, justifyContent: "center", fontSize: 12, borderRadius: 10, marginTop: 4 }}
          onClick={() => openSite()}
        >
          <Globe size={12} style={{ marginRight: 4 }} />
          Open Vaultr Web App
        </button>
      </div>

      {/* Resources & Information Deep Links */}
      <div className="settings-section">
        <div className="settings-section-title">VAULTR 2026 RESOURCES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", height: 34, justifyContent: "space-between", fontSize: 12, padding: "0 10px", borderRadius: 8 }}
            onClick={() => openSite("/docs")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} style={{ color: "#38bdf8" }} />
              Documentation & Guides
            </span>
            <ExternalLink size={11} style={{ color: "var(--neutral-600)" }} />
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: "100%", height: 34, justifyContent: "space-between", fontSize: 12, padding: "0 10px", borderRadius: 8 }}
            onClick={() => openSite("/changelog")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <History size={13} style={{ color: "#fbbf24" }} />
              Release Notes & Changelog
            </span>
            <ExternalLink size={11} style={{ color: "var(--neutral-600)" }} />
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: "100%", height: 34, justifyContent: "space-between", fontSize: 12, padding: "0 10px", borderRadius: 8 }}
            onClick={() => openSite("/security")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Shield size={13} style={{ color: "#34d399" }} />
              Security Architecture
            </span>
            <ExternalLink size={11} style={{ color: "var(--neutral-600)" }} />
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: "100%", height: 34, justifyContent: "space-between", fontSize: 12, padding: "0 10px", borderRadius: 8 }}
            onClick={() => openSite("/privacy")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={13} style={{ color: "#a78bfa" }} />
              Privacy Policy & Terms
            </span>
            <ExternalLink size={11} style={{ color: "var(--neutral-600)" }} />
          </button>

          <button
            className="btn btn-ghost"
            style={{ width: "100%", height: 34, justifyContent: "space-between", fontSize: 12, padding: "0 10px", borderRadius: 8 }}
            onClick={() => openSite("/settings/support")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <LifeBuoy size={13} style={{ color: "#f43f5e" }} />
              Help Desk & Support
            </span>
            <ExternalLink size={11} style={{ color: "var(--neutral-600)" }} />
          </button>
        </div>
      </div>

      {/* About Badge Card */}
      <div className="settings-section" style={{ borderBottom: "none", paddingTop: 10, paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "#0d0d0d", border: "1px solid var(--border)", borderRadius: 12 }}>
          <ShieldCheck size={16} style={{ color: "#10b981", marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ color: "var(--neutral-200)" }}>{VAULTR_EDITION} Extension</strong>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--neutral-500)" }}>v{VAULTR_VERSION}</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--neutral-500)", display: "block", marginTop: 2 }}>
              Build {VAULTR_BUILD_NUMBER} · AES-256-GCM Zero-Knowledge
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
