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
  Maximize2,
  Hash,
  Palette,
  Sparkles,
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
import { PinPad } from "./PinPad";
import {
  isPinSet,
  getPinLength,
  setupPin,
  clearPin,
} from "../services/pin";

export type PopupWidth = "normal" | "wide" | "wider" | "extended";

export const POPUP_SIZE_MAP: Record<PopupWidth, { width: number; height: number }> = {
  normal: { width: 380, height: 560 },
  wide: { width: 460, height: 560 },
  wider: { width: 540, height: 560 },
  extended: { width: 620, height: 600 },
};

export const POPUP_WIDTH_MAP: Record<PopupWidth, number> = {
  normal: 380,
  wide: 460,
  wider: 540,
  extended: 620,
};

export function applyPopupWidth(width: PopupWidth | string) {
  const size = POPUP_SIZE_MAP[width as PopupWidth] || POPUP_SIZE_MAP.normal;
  if (typeof document !== "undefined") {
    if (document.documentElement) {
      document.documentElement.style.width = `${size.width}px`;
      document.documentElement.style.height = `${size.height}px`;
      document.documentElement.setAttribute("data-popup-width", String(width));
    }
    if (document.body) {
      document.body.style.width = `${size.width}px`;
      document.body.style.height = `${size.height}px`;
    }
  }
}

interface SettingsScreenProps {
  serverUrl: string;
  accountInfo: AccountInfo;
  onUpdateServerUrl: (url: string) => Promise<void>;
  onLock: () => void;
  currentTheme?: "dark" | "light" | "midnight";
  onThemeChange?: (theme: "dark" | "light" | "midnight") => void;
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

export type SettingsTab = "autofill" | "security" | "themes" | "about";

export function SettingsScreen({
  serverUrl,
  accountInfo,
  onUpdateServerUrl,
  onLock,
  currentTheme = "dark",
  onThemeChange,
}: SettingsScreenProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("autofill");

  // Autofill section state (all default ON)
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [autofillSubmit, setAutofillSubmit] = useState(true);
  const [autoCopy2fa, setAutoCopy2fa] = useState(true);
  const [subdomainMatching, setSubdomainMatching] = useState(true);
  const [promptSave, setPromptSave] = useState(true);
  const [promptUpdate, setPromptUpdate] = useState(true);
  const [browserOverrideActive, setBrowserOverrideActive] = useState(false);
  const [browserOverrideSupported, setBrowserOverrideSupported] = useState(true);
  const [isEdgeBrowser, setIsEdgeBrowser] = useState(() => {
    return typeof navigator !== "undefined" && /Edg\//i.test(navigator.userAgent);
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Security section state
  const [autoLockMinutes, setAutoLockMinutes] = useState("15");
  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);
  const [bioEnrolling, setBioEnrolling] = useState(false);
  const [bioError, setBioError] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [promptPassword, setPromptPassword] = useState("");

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

  // Quick PIN state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinLength, setPinLength] = useState(4);
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState<"prompt_password" | "choose_pin" | "confirm_pin">("choose_pin");
  const [pinActivePassword, setPinActivePassword] = useState("");
  const [pinPromptPw, setPinPromptPw] = useState("");
  const [pinSetupLength, setPinSetupLength] = useState<4 | 6>(4);
  const [pinSetupFirst, setPinSetupFirst] = useState("");
  const [pinSetupConfirm, setPinSetupConfirm] = useState("");
  const [pinModalError, setPinModalError] = useState("");
  const [pinSetupSaving, setPinSetupSaving] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Themes & Appearance state (all default ON)
  const [activeTheme, setActiveTheme] = useState<"dark" | "light" | "midnight">(currentTheme);
  const [popupWidth, setPopupWidth] = useState<PopupWidth>("normal");
  const [showBadgeCount, setShowBadgeCount] = useState(true);
  const [showAnimations, setShowAnimations] = useState(true);

  // About section state
  const [url, setUrl] = useState(serverUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(
        [
          "autofill_enabled",
          "vaultr_show_badge_count",
          "vaultr_subdomain_matching",
          "autofill_submit",
          "vaultr_prompt_save",
          "vaultr_prompt_update",
          "vaultr_show_animations",
          "vaultr_theme",
          "autolock_minutes",
          "vaultr_passkeys_enabled",
          "vaultr_biometric_enrolled",
          "vaultr_default_manager",
          "vaultr_autocopy_2fa",
          "vaultr_popup_width",
        ],
        async (res) => {
          if (res.autofill_enabled !== undefined) setAutofillEnabled(res.autofill_enabled !== false);
          if (res.vaultr_show_badge_count !== undefined) setShowBadgeCount(res.vaultr_show_badge_count !== false);
          if (res.vaultr_subdomain_matching !== undefined) setSubdomainMatching(res.vaultr_subdomain_matching !== false);
          // Auto-submit form defaults to true
          if (res.autofill_submit !== undefined) setAutofillSubmit(res.autofill_submit !== false);
          else setAutofillSubmit(true);
          // Prompt save & update default to true
          if (res.vaultr_prompt_save !== undefined) setPromptSave(res.vaultr_prompt_save !== false);
          if (res.vaultr_prompt_update !== undefined) setPromptUpdate(res.vaultr_prompt_update !== false);
          // Show animations defaults to true
          if (res.vaultr_show_animations !== undefined) {
            const anim = res.vaultr_show_animations !== false;
            setShowAnimations(anim);
            if (!anim && typeof document !== "undefined") {
              document.documentElement.setAttribute("data-animations", "disabled");
            }
          }
          // Theme defaults to dark or stored theme
          if (res.vaultr_theme) {
            setActiveTheme(res.vaultr_theme);
            if (typeof document !== "undefined") {
              document.documentElement.setAttribute("data-theme", res.vaultr_theme);
            }
          }
          if (res.autolock_minutes !== undefined) setAutoLockMinutes(res.autolock_minutes);
          if (res.vaultr_passkeys_enabled !== undefined) setPasskeysEnabled(res.vaultr_passkeys_enabled);
          if (res.vaultr_biometric_enrolled !== undefined) setBiometricsEnrolled(res.vaultr_biometric_enrolled);
          if (res.vaultr_default_manager !== undefined) setBrowserOverrideActive(res.vaultr_default_manager);
          if (res.vaultr_autocopy_2fa !== undefined) setAutoCopy2fa(res.vaultr_autocopy_2fa !== false);
          if (res.vaultr_popup_width) {
            setPopupWidth(res.vaultr_popup_width as PopupWidth);
            applyPopupWidth(res.vaultr_popup_width as PopupWidth);
          }

          const avail = await isPlatformAuthenticatorAvailable();
          setBiometricsSupported(avail);

          const pinSet = await isPinSet();
          setPinEnabled(pinSet);
          if (pinSet) {
            const len = await getPinLength();
            setPinLength(len);
            setPinSetupLength(len === 6 ? 6 : 4);
          }
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
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_autocopy_2fa: enabled });
    }
  };

  const handleToggleAutofill = (enabled: boolean) => {
    setAutofillEnabled(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ autofill_enabled: enabled });
    }
  };

  const handleToggleShowBadgeCount = (enabled: boolean) => {
    setShowBadgeCount(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_show_badge_count: enabled }, () => {
        chrome.runtime?.sendMessage?.({ type: "UPDATE_BADGES" }, () => {
          if (chrome.runtime?.lastError) {}
        });
      });
    }
  };

  const handleToggleSubdomainMatching = (enabled: boolean) => {
    setSubdomainMatching(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_subdomain_matching: enabled });
    }
  };

  const handleToggleSubmit = (enabled: boolean) => {
    setAutofillSubmit(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ autofill_submit: enabled });
    }
  };

  const handleTogglePromptSave = (enabled: boolean) => {
    setPromptSave(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_prompt_save: enabled });
    }
  };

  const handleTogglePromptUpdate = (enabled: boolean) => {
    setPromptUpdate(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_prompt_update: enabled });
    }
  };

  const handleToggleShowAnimations = (enabled: boolean) => {
    setShowAnimations(enabled);
    if (typeof document !== "undefined") {
      if (enabled) {
        document.documentElement.removeAttribute("data-animations");
      } else {
        document.documentElement.setAttribute("data-animations", "disabled");
      }
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_show_animations: enabled });
    }
  };

  const handleThemeSelect = (newTheme: "dark" | "light" | "midnight") => {
    setActiveTheme(newTheme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_theme: newTheme });
    }
    onThemeChange?.(newTheme);
  };

  const handleTogglePasskeys = (enabled: boolean) => {
    setPasskeysEnabled(enabled);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_passkeys_enabled: enabled });
    }
  };

  const handleToggleBiometrics = async (enrolled: boolean) => {
    if (!enrolled) {
      setBiometricsEnrolled(false);
      setBioError("");
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ vaultr_biometric_enrolled: false, vaultr_biometric_cred_id: null });
      }
      return;
    }
    setShowPasswordPrompt(true);
    setPromptPassword("");
    setBioError("");
  };

  const executeBiometricEnrollment = async (password: string) => {
    setBioEnrolling(true);
    setBioError("");
    try {
      const cred = await enrollBiometricUnlock(password);
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({
          vaultr_biometric_enrolled: true,
          vaultr_biometric_cred_id: cred.credentialId,
          vaultr_biometric_blob: {
            credentialId: cred.credentialId,
            encryptedPassword: cred.encryptedPassword,
            iv: cred.iv,
          },
        });
      }
      setBiometricsEnrolled(true);
      setShowPasswordPrompt(false);
      setPromptPassword("");
    } catch (err: any) {
      setBioError(err?.message || "Biometric authentication failed or was cancelled.");
    } finally {
      setBioEnrolling(false);
    }
  };

  const handleTogglePin = async (enable: boolean) => {
    if (!enable) {
      try {
        await clearPin();
        setPinEnabled(false);
        setPinMsg({ text: "Quick PIN disabled.", ok: true });
        setTimeout(() => setPinMsg(null), 3000);
      } catch (err: any) {
        setPinMsg({ text: err?.message || "Failed to clear PIN", ok: false });
      }
      return;
    }
    setPinSetupStep("prompt_password");
    setPinPromptPw("");
    setPinActivePassword("");
    setPinSetupFirst("");
    setPinSetupConfirm("");
    setPinModalError("");
    setShowPinSetupModal(true);
  };

  const handleVerifyPromptPassword = () => {
    if (!pinPromptPw) {
      setPinModalError("Master password is required.");
      return;
    }
    setPinActivePassword(pinPromptPw);
    setPinPromptPw("");
    setPinModalError("");
    setPinSetupStep("choose_pin");
    setPinSetupFirst("");
    setPinSetupConfirm("");
  };

  const handleSaveNewPin = async () => {
    if (!pinSetupConfirm || pinSetupConfirm.length !== pinSetupLength) {
      setPinModalError(`Please enter all ${pinSetupLength} digits.`);
      return;
    }
    if (pinSetupFirst !== pinSetupConfirm) {
      setPinModalError("PINs do not match. Please try again.");
      setPinSetupConfirm("");
      setPinSetupStep("choose_pin");
      return;
    }
    if (!pinActivePassword) {
      setPinModalError("Authorization expired. Please re-authorize.");
      setPinSetupStep("prompt_password");
      return;
    }

    setPinSetupSaving(true);
    setPinModalError("");
    try {
      await setupPin(pinSetupConfirm, pinActivePassword);
      setPinEnabled(true);
      setPinLength(pinSetupLength);
      setShowPinSetupModal(false);
      setPinActivePassword("");
      setPinSetupFirst("");
      setPinSetupConfirm("");
      setPinMsg({ text: `Quick PIN configured (${pinSetupLength} digits).`, ok: true });
      setTimeout(() => setPinMsg(null), 3500);
    } catch (err: any) {
      setPinModalError(err?.message || "Failed to configure PIN.");
    } finally {
      setPinSetupSaving(false);
    }
  };

  const handleStartChangePin = () => {
    setPinSetupStep("prompt_password");
    setPinPromptPw("");
    setPinActivePassword("");
    setPinSetupFirst("");
    setPinSetupConfirm("");
    setPinModalError("");
    setShowPinSetupModal(true);
  };

  const handleAutolockChange = (minutes: string) => {
    setAutoLockMinutes(minutes);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ autolock_minutes: minutes });
      chrome.runtime?.sendMessage({ type: "SET_AUTOLOCK", minutes });
    }
  };

  const handleWidthChange = (width: PopupWidth) => {
    setPopupWidth(width);
    applyPopupWidth(width);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ vaultr_popup_width: width });
    }
  };

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    await onUpdateServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const openSite = (path = "") => {
    const cleanServer = serverUrl.replace(/\/+$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const targetUrl = path ? `${cleanServer}${cleanPath}` : cleanServer;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, "_blank");
    }
  };

  const loadSessions = () => {
    setSessionsLoading(true);
    setSessionsError("");
    chrome.runtime.sendMessage({ type: "GET_SESSIONS" }, (res) => {
      setSessionsLoading(false);
      if (chrome.runtime.lastError) {
        setSessionsError("Could not connect to background service.");
        return;
      }
      if (res?.error) {
        setSessionsError(res.error);
        return;
      }
      if (Array.isArray(res?.sessions)) {
        setSessions(res.sessions);
      }
    });
  };

  const handleRevokeSession = (sessionId: string) => {
    setRevokingId(sessionId);
    chrome.runtime.sendMessage({ type: "REVOKE_SESSION", sessionId }, (res) => {
      setRevokingId(null);
      if (chrome.runtime.lastError || res?.error) {
        setSessionsError(res?.error || "Failed to revoke session.");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    });
  };

  const handleRevokeAllSessions = () => {
    setRevokingAll(true);
    chrome.runtime.sendMessage({ type: "REVOKE_ALL_SESSIONS" }, (res) => {
      setRevokingAll(false);
      setConfirmRevokeAll(false);
      if (chrome.runtime.lastError || res?.error) {
        setSessionsError(res?.error || "Failed to revoke sessions.");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    });
  };

  const handleChangeMasterPassword = () => {
    if (!oldPw || !newPw || !confirmPw) return;
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: "Password must be at least 8 characters.", ok: false });
      return;
    }
    setPwChanging(true);
    setPwMsg(null);
    chrome.runtime.sendMessage(
      { type: "CHANGE_MASTER_PASSWORD", oldPassword: oldPw, newPassword: newPw },
      (res) => {
        setPwChanging(false);
        if (chrome.runtime.lastError) {
          setPwMsg({ text: "Could not reach background service.", ok: false });
          return;
        }
        if (res?.success) {
          setPwMsg({ text: "Master password changed & vault re-encrypted successfully!", ok: true });
          setOldPw("");
          setNewPw("");
          setConfirmPw("");
        } else {
          setPwMsg({ text: res?.error || "Failed to change master password.", ok: false });
        }
      }
    );
  };

  const renderSessionCard = (session: SessionData) => {
    const isThisExtension = session.isCurrent;
    const isBusy = revokingId === session.sessionId;
    const isMob = session.isMobile || session.clientType === "mobile_app" || session.clientType === "mobile_browser";

    return (
      <div
        key={session.sessionId}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: isThisExtension ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid var(--border)",
          background: isThisExtension ? "rgba(56, 189, 248, 0.05)" : "var(--surface)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: isThisExtension ? "rgba(56, 189, 248, 0.15)" : "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isThisExtension ? "#38bdf8" : "var(--neutral-400)",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {isMob ? <Smartphone size={15} /> : <Monitor size={15} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-100)" }}>
                {session.deviceName || session.browser || "Unknown Device"}
              </span>
              {isThisExtension && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  THIS EXTENSION
                </span>
              )}
            </div>

            <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{session.browser}</span>
              {session.os && <span>· {session.os}</span>}
              {session.city && session.country && (
                <span>· {session.city}, {session.country}</span>
              )}
            </div>

            <div style={{ fontSize: 10, color: "var(--neutral-500)", marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} /> {relativeTime(session.lastActiveAt)}
              </span>
              <span>Signed in {formatDate(session.createdAt)}</span>
            </div>
          </div>
        </div>

        {!isThisExtension && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              height: 26,
              padding: "0 8px",
              fontSize: 10.5,
              color: "#f87171",
              borderColor: "rgba(239, 68, 68, 0.25)",
              flexShrink: 0,
            }}
            disabled={isBusy || revokingAll}
            onClick={() => handleRevokeSession(session.sessionId)}
            title="Sign out this session"
          >
            {isBusy ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <>
                <Trash2 size={11} />
                <span>Revoke</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const initials = accountInfo.name
    ? accountInfo.name.slice(0, 2).toUpperCase()
    : accountInfo.email
    ? accountInfo.email.slice(0, 2).toUpperCase()
    : "VA";

  return (
    <div className="settings-screen">
      {/* Top Account Header Bar */}
      <div className="settings-account-bar">
        <div
          onClick={() => openSite("/settings")}
          className="settings-account-clickable"
          title="Open Account Profile on VaultR"
        >
          {resolveAvatarUrl(accountInfo.image || (accountInfo as any).avatarUrl, serverUrl) ? (
            <img
              src={resolveAvatarUrl(accountInfo.image || (accountInfo as any).avatarUrl, serverUrl)!}
              alt=""
              className="settings-account-avatar-img"
            />
          ) : (
            <div className="settings-account-avatar-initials">
              {initials}
            </div>
          )}
          <div className="settings-account-meta">
            <div className="account-name">
              {accountInfo.name || accountInfo.email || "Vaultr User"}
            </div>
            {accountInfo.email && (
              <div className="account-email">
                {accountInfo.email}
              </div>
            )}
          </div>
          <ChevronRight size={13} style={{ color: "var(--neutral-500)", flexShrink: 0 }} />
        </div>

        <button
          className="btn btn-ghost"
          style={{ height: 28, padding: "0 8px", fontSize: 11, gap: 4, flexShrink: 0, borderRadius: 8 }}
          onClick={() => openSite("/settings")}
          title="Manage Account on Vaultr"
        >
          <ExternalLink size={11} />
          <span>Manage</span>
        </button>
      </div>

      {/* Main 2-Column Settings Container */}
      <div className="settings-container">
        {/* Left Folder Nav Rail */}
        <div className="settings-nav">
          <button
            type="button"
            className={`settings-nav-item ${activeSettingsTab === "autofill" ? "active" : ""}`}
            onClick={() => setActiveSettingsTab("autofill")}
            title="Autofill & Browser Integration"
          >
            <KeyRound size={17} />
            <span>Autofill</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeSettingsTab === "security" ? "active" : ""}`}
            onClick={() => setActiveSettingsTab("security")}
            title="Account Security & Access"
          >
            <ShieldCheck size={17} />
            <span>Security</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeSettingsTab === "themes" ? "active" : ""}`}
            onClick={() => setActiveSettingsTab("themes")}
            title="Themes & Appearance"
          >
            <Palette size={17} />
            <span>Themes</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeSettingsTab === "about" ? "active" : ""}`}
            onClick={() => setActiveSettingsTab("about")}
            title="About VaultR & Resources"
          >
            <Info size={17} />
            <span>About</span>
          </button>
        </div>

        {/* Right Scrollable Content Pane */}
        <div className="settings-content-pane">
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: AUTOFILL & INTEGRATIONS
             ══════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === "autofill" && (
            <>
              <div className="settings-pane-header">
                <div className="settings-pane-title">Autofill & Integration</div>
                <div className="settings-pane-desc">Browser credentials capture, fill triggers and shortcuts</div>
              </div>

              {/* Make VaultR Default Password Manager card */}
              {browserOverrideSupported && (
                <div
                  className="settings-card"
                  style={{
                    border: `1px solid ${browserOverrideActive ? "rgba(16, 185, 129, 0.4)" : "var(--border)"}`,
                    background: browserOverrideActive ? "rgba(16, 185, 129, 0.03)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <ShieldCheck size={14} style={{ color: browserOverrideActive ? "#10b981" : "#38bdf8" }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                          Set as Default Password Manager
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
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
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

              {/* Suggest credentials */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Suggest credentials</div>
                  <div className="settings-row-sub">Show VaultR dropdown popup on input fields</div>
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

              {/* Auto-submit form */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Auto-submit form</div>
                  <div className="settings-row-sub">Automatically submit the login form after filling credentials</div>
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

              {/* Auto-copy 2FA code on fill */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Auto-copy 2FA code</div>
                  <div className="settings-row-sub">Copies one-time TOTP verification code to clipboard upon fill</div>
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

              {/* Match base domain */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Match base domain</div>
                  <div className="settings-row-sub">Suggest credentials across all subdomains (e.g. login.example.com)</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={subdomainMatching}
                    onChange={(e) => handleToggleSubdomainMatching(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Prompt to save new credentials */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Prompt to save passwords</div>
                  <div className="settings-row-sub">Ask to save new logins entered into web forms</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={promptSave}
                    onChange={(e) => handleTogglePromptSave(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Prompt to update existing credentials */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Prompt to update passwords</div>
                  <div className="settings-row-sub">Offer to update existing entries when password changes are detected</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={promptUpdate}
                    onChange={(e) => handleTogglePromptUpdate(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Keyboard Shortcuts Card */}
              <div className="settings-card">
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
                  Keyboard Shortcuts
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, color: "var(--neutral-300)" }}>Autofill credentials</span>
                    <kbd style={{ padding: "2px 6px", fontSize: 10, fontFamily: "monospace", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--neutral-200)" }}>
                      {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘ Shift L" : "Ctrl Shift L"}
                    </kbd>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, color: "var(--neutral-300)" }}>Copy 2FA TOTP code</span>
                    <kbd style={{ padding: "2px 6px", fontSize: 10, fontFamily: "monospace", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--neutral-200)" }}>
                      {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘ Shift T" : "Ctrl Shift T"}
                    </kbd>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: ACCOUNT SECURITY & ACCESS
             ══════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === "security" && (
            <>
              <div className="settings-pane-header">
                <div className="settings-pane-title">Account Security & Access</div>
                <div className="settings-pane-desc">Biometrics, quick PIN, auto-lock timeouts and active devices</div>
              </div>

              {/* Biometric Unlock Card */}
              {biometricsSupported && (
                <div className="settings-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Fingerprint size={15} style={{ color: "#34d399" }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                          Unlock with Biometrics
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
                        {biometricsEnrolled
                          ? "Windows Hello or Touch ID unlock is active on this browser."
                          : "Use Windows Hello, Touch ID or system biometric key to unlock without typing your master password."}
                      </div>
                    </div>
                    <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
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

              {/* Quick PIN Unlock Card */}
              <div
                className="settings-card"
                style={{
                  border: `1px solid ${pinEnabled ? "rgba(56, 189, 248, 0.3)" : "var(--border)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Hash size={14} style={{ color: pinEnabled ? "#38bdf8" : "var(--neutral-400)" }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                        Unlock with PIN
                      </span>
                      {pinEnabled && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Check size={9} /> {pinLength}-DIGIT ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
                      {pinEnabled
                        ? `Your ${pinLength}-digit PIN is active. Use it to quickly re-unlock your vault on this device.`
                        : "Set a 4 or 6-digit PIN for lightning-fast PBKDF2 + AES-GCM vault re-unlock."}
                    </div>
                  </div>
                  <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={pinEnabled}
                      onChange={(e) => handleTogglePin(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {pinEnabled && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{
                        height: 26,
                        padding: "0 10px",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 6,
                        color: "#38bdf8",
                      }}
                      onClick={handleStartChangePin}
                    >
                      Change PIN
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}

                {pinMsg && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: pinMsg.ok ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                      border: `1px solid ${pinMsg.ok ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                      color: pinMsg.ok ? "#10b981" : "#f87171",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {pinMsg.ok ? <Check size={12} /> : <Info size={12} />}
                    <span>{pinMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Auto-lock timeout */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Auto-lock timeout</div>
                  <div className="settings-row-sub">Lock vault automatically after inactivity</div>
                </div>
                <select
                  className="form-select"
                  style={{ width: "auto", fontSize: 11.5, padding: "5px 10px", borderRadius: 8 }}
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

              {/* Passkeys & Hardware Security */}
              <div className="settings-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <KeyRound size={14} style={{ color: "#38bdf8" }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                        Passkeys & WebAuthn
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
                      Save and autofill FIDO2/WebAuthn passkeys directly with VaultR
                    </div>
                  </div>
                  <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={passkeysEnabled}
                      onChange={(e) => handleTogglePasskeys(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Sessions & Devices Accordion */}
              <div className="settings-card">
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
                    <Monitor size={14} style={{ color: "#38bdf8", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                        Manage Sessions
                      </div>
                      <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.3 }}>
                        {sessions.length > 0
                          ? `${sessions.length} active session${sessions.length !== 1 ? "s" : ""}`
                          : "Review and revoke active sign-ins"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      height: 24,
                      padding: "0 8px",
                      fontSize: 10.5,
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
                    {showSessions ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                </div>

                {showSessions && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--neutral-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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

                    {sessionsLoading && sessions.length === 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 44, borderRadius: 8, background: "var(--surface-2)", opacity: 0.6 }} className="animate-pulse" />
                        <div style={{ height: 44, borderRadius: 8, background: "var(--surface-2)", opacity: 0.4 }} className="animate-pulse" />
                      </div>
                    )}

                    {!sessionsLoading && sessions.length === 0 && !sessionsError && (
                      <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: "var(--neutral-500)" }}>
                        No active sessions found.
                      </div>
                    )}

                    {currentSession && renderSessionCard(currentSession)}
                    {otherSessions.map((s) => renderSessionCard(s))}
                  </div>
                )}
              </div>

              {/* Change Master Password Accordion */}
              <div className="settings-card">
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
                        Re-encrypt vault items with a new master key
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      height: 24,
                      padding: "0 8px",
                      fontSize: 10.5,
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
                    {showChangePw ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                </div>

                {showChangePw && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
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

              {/* Lock Vault Button */}
              <button
                className="btn btn-danger"
                style={{ width: "100%", height: 36, justifyContent: "center", borderRadius: 10, fontSize: 12, fontWeight: 500, marginTop: 4 }}
                onClick={onLock}
              >
                <Lock size={13} style={{ marginRight: 4 }} />
                Lock Vault Now
              </button>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: THEMES & APPEARANCE
             ══════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === "themes" && (
            <>
              <div className="settings-pane-header">
                <div className="settings-pane-title">Themes & Appearance</div>
                <div className="settings-pane-desc">Visual color schemes, extension window sizing & animations</div>
              </div>

              {/* Theme Picker */}
              <div className="settings-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-100)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Palette size={14} style={{ color: "#38bdf8" }} />
                  Color Theme
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", marginTop: 2 }}>
                  Select your interface theme for the extension popup
                </div>

                <div className="theme-picker-grid">
                  {/* Dark Theme */}
                  <div
                    className={`theme-card-option ${activeTheme === "dark" ? "active" : ""}`}
                    onClick={() => handleThemeSelect("dark")}
                  >
                    <div className="theme-preview-swatch" style={{ background: "#0a0a0a" }}>
                      <div className="theme-preview-dot" style={{ background: "#ffffff" }} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--neutral-100)" }}>Dark</div>
                    <div style={{ fontSize: 9.5, color: "var(--neutral-500)" }}>Obsidian</div>
                  </div>

                  {/* Zinc Light Theme */}
                  <div
                    className={`theme-card-option ${activeTheme === "light" ? "active" : ""}`}
                    onClick={() => handleThemeSelect("light")}
                  >
                    <div className="theme-preview-swatch" style={{ background: "#fafafa", borderColor: "#e4e4e7" }}>
                      <div className="theme-preview-dot" style={{ background: "#09090b" }} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--neutral-100)" }}>Zinc Light</div>
                    <div style={{ fontSize: 9.5, color: "var(--neutral-500)" }}>Crisp & Clean</div>
                  </div>

                  {/* Midnight Theme */}
                  <div
                    className={`theme-card-option ${activeTheme === "midnight" ? "active" : ""}`}
                    onClick={() => handleThemeSelect("midnight")}
                  >
                    <div className="theme-preview-swatch" style={{ background: "#070a13", borderColor: "#1e293b" }}>
                      <div className="theme-preview-dot" style={{ background: "#38bdf8" }} />
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--neutral-100)" }}>Midnight</div>
                    <div style={{ fontSize: 9.5, color: "var(--neutral-500)" }}>Deep Slate</div>
                  </div>
                </div>
              </div>

              {/* Popup Window Size */}
              <div className="settings-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <div className="settings-row-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Maximize2 size={13} style={{ color: "#38bdf8" }} />
                      Extension Window Width
                    </div>
                    <div className="settings-row-sub">Choose your preferred extension viewport size</div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#38bdf8", fontWeight: 600, background: "rgba(56, 189, 248, 0.12)", padding: "2px 6px", borderRadius: 6 }}>
                    {POPUP_SIZE_MAP[popupWidth].width} × {POPUP_SIZE_MAP[popupWidth].height}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
                  {(
                    [
                      { id: "normal", label: "Normal", desc: "380px" },
                      { id: "wide", label: "Wide", desc: "460px" },
                      { id: "wider", label: "Wider", desc: "540px" },
                      { id: "extended", label: "Extended", desc: "620px" },
                    ] as const
                  ).map(({ id, label, desc }) => {
                    const active = popupWidth === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleWidthChange(id)}
                        style={{
                          padding: "6px 2px",
                          borderRadius: 8,
                          border: active ? "1px solid #38bdf8" : "1px solid var(--border)",
                          background: active ? "rgba(56, 189, 248, 0.12)" : "var(--surface-2)",
                          color: active ? "#38bdf8" : "var(--neutral-400)",
                          fontSize: 10.5,
                          fontWeight: active ? 600 : 500,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          transition: "all 0.12s ease",
                        }}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: 9, opacity: 0.75, fontFamily: "monospace" }}>{desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show suggestions badge count on extension icon (all on by default) */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Show suggestions badge on icon</div>
                  <div className="settings-row-sub">Display number of matching login suggestions on extension toolbar icon</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showBadgeCount}
                    onChange={(e) => handleToggleShowBadgeCount(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Show animations (all on by default) */}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Show animations</div>
                  <div className="settings-row-sub">Enable smooth interface transitions and randomisation cipher scrambles</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showAnimations}
                    onChange={(e) => handleToggleShowAnimations(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: ABOUT VAULTR & RESOURCES
             ══════════════════════════════════════════════════════════════════ */}
          {activeSettingsTab === "about" && (
            <>
              {/* VaultR Wide Logo Branding Hero */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "18px 14px 16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  gap: 8,
                }}
              >
                <img
                  src={activeTheme === "light" ? "brand/vaultr-full-light-transparent.png" : "brand/vaultr-full-dark-transparent.png"}
                  alt="VaultR"
                  style={{ height: 26, width: "auto", maxWidth: "80%", objectFit: "contain" }}
                />
                <div style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.35, maxWidth: 260 }}>
                  Zero-Knowledge Password Management & Digital Security
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                    }}
                  >
                    {VAULTR_EDITION}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "var(--surface-2)",
                      color: "var(--neutral-300)",
                      border: "1px solid var(--border)",
                      fontFamily: "monospace",
                    }}
                  >
                    v{VAULTR_VERSION}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#10b981",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Check size={10} /> Zero-Knowledge
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: "var(--neutral-500)", fontFamily: "monospace", marginTop: 2 }}>
                  Build {VAULTR_BUILD_NUMBER} · {VAULTR_CRYPTO_SPEC.algorithm}
                </div>
              </div>

              {/* Server Connection URL */}
              <div className="settings-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-100)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe size={13} style={{ color: "#38bdf8" }} />
                  Server Connection
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-400)", marginBottom: 8 }}>
                  VaultR sync backend server endpoint
                </div>
                <form onSubmit={handleSaveUrl}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://vaultr.yourdomain.com"
                      style={{ flex: 1, height: 34, fontSize: 11.5 }}
                    />
                    <button
                      type="submit"
                      className={`btn btn-primary${saved ? " btn-success" : ""}`}
                      style={{ height: 34, padding: "0 12px", fontSize: 11.5 }}
                    >
                      {saved ? "Saved" : "Save"}
                    </button>
                  </div>
                </form>

                <button
                  className="btn btn-ghost"
                  style={{ width: "100%", height: 32, justifyContent: "center", fontSize: 11.5, borderRadius: 8, marginTop: 8 }}
                  onClick={() => openSite()}
                >
                  <Globe size={12} style={{ marginRight: 4 }} />
                  Open Vaultr Web App
                </button>
              </div>

              {/* Documentation & Resources Links */}
              <div className="settings-card">
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", letterSpacing: "0.04em", marginBottom: 6, textTransform: "uppercase" }}>
                  Resources & Support
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 32, justifyContent: "space-between", fontSize: 11.5, padding: "0 8px", borderRadius: 8 }}
                    onClick={() => openSite("/docs")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <BookOpen size={13} style={{ color: "#38bdf8" }} />
                      Documentation & Guides
                    </span>
                    <ExternalLink size={11} style={{ color: "var(--neutral-500)" }} />
                  </button>

                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 32, justifyContent: "space-between", fontSize: 11.5, padding: "0 8px", borderRadius: 8 }}
                    onClick={() => openSite("/changelog")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <History size={13} style={{ color: "#fbbf24" }} />
                      Release Notes & Changelog
                    </span>
                    <ExternalLink size={11} style={{ color: "var(--neutral-500)" }} />
                  </button>

                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 32, justifyContent: "space-between", fontSize: 11.5, padding: "0 8px", borderRadius: 8 }}
                    onClick={() => openSite("/security")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Shield size={13} style={{ color: "#34d399" }} />
                      Security Architecture
                    </span>
                    <ExternalLink size={11} style={{ color: "var(--neutral-500)" }} />
                  </button>

                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 32, justifyContent: "space-between", fontSize: 11.5, padding: "0 8px", borderRadius: 8 }}
                    onClick={() => openSite("/privacy")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <FileText size={13} style={{ color: "#a78bfa" }} />
                      Privacy Policy & Terms
                    </span>
                    <ExternalLink size={11} style={{ color: "var(--neutral-500)" }} />
                  </button>

                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 32, justifyContent: "space-between", fontSize: 11.5, padding: "0 8px", borderRadius: 8 }}
                    onClick={() => openSite("/settings/support")}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <LifeBuoy size={13} style={{ color: "#f43f5e" }} />
                      Help Desk & Support
                    </span>
                    <ExternalLink size={11} style={{ color: "var(--neutral-500)" }} />
                  </button>
                </div>
              </div>

              {/* End-to-End Encrypted Footer */}
              <div style={{ textAlign: "center", padding: "4px 0 8px", fontSize: 10, color: "var(--neutral-500)" }}>
                VaultR Core · End-to-End Zero-Knowledge Encrypted
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          OVERLAY MODALS (Outside the scrollable content)
         ══════════════════════════════════════════════════════════════════ */}

      {/* Password Prompt Modal for Biometrics Setup */}
      {showPasswordPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
              width: "100%",
              maxWidth: 280,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Fingerprint size={18} style={{ color: "#34d399" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--neutral-100)" }}>
                Enable Biometric Unlock
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4, margin: 0 }}>
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
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPromptPassword("");
                }}
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

      {/* Quick PIN Setup / Change Modal */}
      {showPinSetupModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: "20px 18px 16px",
              width: "100%",
              maxWidth: 310,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start", width: "100%" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Hash size={16} style={{ color: "#38bdf8" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--neutral-100)" }}>
                  {pinSetupStep === "prompt_password"
                    ? "Authorize PIN Setup"
                    : pinSetupStep === "confirm_pin"
                    ? "Confirm Your PIN"
                    : pinEnabled
                    ? "Change Quick PIN"
                    : "Set Up Quick PIN"}
                </div>
                <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 1 }}>
                  {pinSetupStep === "prompt_password"
                    ? "Enter master password to proceed"
                    : pinSetupStep === "confirm_pin"
                    ? `Re-enter your ${pinSetupLength}-digit PIN`
                    : `Choose a ${pinSetupLength}-digit PIN`}
                </div>
              </div>
            </div>

            {pinSetupStep === "prompt_password" && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11.5, color: "var(--neutral-400)", lineHeight: 1.4, margin: 0 }}>
                  Enter your master password once to configure PIN re-unlock on this browser.
                </p>
                <input
                  type="password"
                  className="form-input"
                  value={pinPromptPw}
                  onChange={(e) => setPinPromptPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPromptPassword()}
                  placeholder="Master password"
                  autoFocus
                  style={{ width: "100%", height: 38, fontSize: 12 }}
                />
                {pinModalError && (
                  <div style={{ fontSize: 11, color: "#f87171" }}>{pinModalError}</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1, height: 34, fontSize: 11.5, justifyContent: "center" }}
                    onClick={() => {
                      setShowPinSetupModal(false);
                      setPinPromptPw("");
                      setPinModalError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, height: 34, fontSize: 11.5, justifyContent: "center" }}
                    disabled={!pinPromptPw}
                    onClick={handleVerifyPromptPassword}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {pinSetupStep === "choose_pin" && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {/* Length selector pills */}
                <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                  <button
                    type="button"
                    className={`folder-pill ${pinSetupLength === 4 ? "active" : ""}`}
                    onClick={() => {
                      setPinSetupLength(4);
                      setPinSetupFirst("");
                      setPinModalError("");
                    }}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                  >
                    4 Digits
                  </button>
                  <button
                    type="button"
                    className={`folder-pill ${pinSetupLength === 6 ? "active" : ""}`}
                    onClick={() => {
                      setPinSetupLength(6);
                      setPinSetupFirst("");
                      setPinModalError("");
                    }}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                  >
                    6 Digits
                  </button>
                </div>

                <PinPad
                  length={pinSetupLength}
                  value={pinSetupFirst}
                  onChange={setPinSetupFirst}
                  onComplete={() => {
                    setPinSetupStep("confirm_pin");
                    setPinSetupConfirm("");
                    setPinModalError("");
                  }}
                  errorMessage={pinModalError}
                />

                <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 30, fontSize: 11, color: "var(--neutral-500)", padding: "0 14px" }}
                    onClick={() => {
                      setShowPinSetupModal(false);
                      setPinSetupFirst("");
                      setPinSetupConfirm("");
                      setPinModalError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {pinSetupStep === "confirm_pin" && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <PinPad
                  length={pinSetupLength}
                  value={pinSetupConfirm}
                  onChange={setPinSetupConfirm}
                  disabled={pinSetupSaving}
                  onComplete={handleSaveNewPin}
                  errorMessage={pinModalError}
                />

                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 30, fontSize: 11, color: "var(--neutral-400)", padding: "0 10px" }}
                    onClick={() => {
                      setPinSetupStep("choose_pin");
                      setPinSetupConfirm("");
                      setPinModalError("");
                    }}
                  >
                    ← Change PIN
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 30, fontSize: 11, color: "var(--neutral-500)", padding: "0 10px" }}
                    onClick={() => {
                      setShowPinSetupModal(false);
                      setPinSetupFirst("");
                      setPinSetupConfirm("");
                      setPinModalError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
