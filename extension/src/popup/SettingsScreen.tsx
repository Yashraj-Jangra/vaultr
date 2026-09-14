import React, { useState, useEffect } from "react";
import {
  Lock,
  Info,
  ExternalLink,
  ChevronRight,
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
  const [copiedSettings, setCopiedSettings] = useState(false);

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
                navigator.clipboard.writeText("chrome://settings/passkeys");
                setCopiedSettings(true);
                setTimeout(() => setCopiedSettings(false), 2000);
              }}
            >
              {copiedSettings ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
              {copiedSettings ? "Copied Chrome URL" : "Copy Chrome Link"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, height: 28, fontSize: 10, justifyContent: "center", gap: 4, padding: "0 8px" }}
              onClick={() => {
                navigator.clipboard.writeText("edge://settings/passwords");
                setCopiedSettings(true);
                setTimeout(() => setCopiedSettings(false), 2000);
              }}
            >
              {copiedSettings ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
              {copiedSettings ? "Copied Edge URL" : "Copy Edge Link"}
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
                  {browserOverrideActive
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
                  MANAGING BROWSER PASSWORD SETTING
                </span>
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
          <div>
            <div className="settings-row-label">Match subdomains</div>
            <div className="settings-row-sub">Suggest credentials across subdomains (e.g. abc.example.com on example.com)</div>
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
