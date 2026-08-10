import React, { useState, useEffect } from "react";
import { Lock, Info, ExternalLink, ChevronRight } from "lucide-react";
import { AccountInfo } from "./App";

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
  const [autofillSubmit, setAutofillSubmit] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState("15");

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        ["autofill_enabled", "autofill_submit", "autolock_minutes"],
        (res) => {
          if (res.autofill_enabled !== undefined) setAutofillEnabled(res.autofill_enabled);
          if (res.autofill_submit !== undefined) setAutofillSubmit(res.autofill_submit);
          if (res.autolock_minutes !== undefined) setAutoLockMinutes(res.autolock_minutes);
        }
      );
    }
  }, []);

  const handleToggleAutofill = (enabled: boolean) => {
    setAutofillEnabled(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ autofill_enabled: enabled });
    }
  };

  const handleToggleSubmit = (enabled: boolean) => {
    setAutofillSubmit(enabled);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ autofill_submit: enabled });
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
          {accountInfo.image ? (
            <img
              src={accountInfo.image}
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

      {/* Autofill Preferences */}
      <div className="settings-section">
        <div className="settings-section-title">AUTOFILL PREFERENCES</div>

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
                placeholder="https://vaultr.cvweb.qzz.io"
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
          <ExternalLink size={12} style={{ marginRight: 4 }} />
          Open Vaultr Web App
        </button>
      </div>

      {/* About Section */}
      <div className="settings-section" style={{ borderBottom: "none", paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "#0d0d0d", border: "1px solid var(--border)", borderRadius: 12 }}>
          <Info size={14} style={{ color: "var(--neutral-500)", marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>
            <strong style={{ color: "var(--neutral-200)" }}>Vaultr Extension v1.0.0</strong>
            <br />
            Zero-knowledge AES-256-GCM client-side encryption. Your master password never leaves your device.
          </span>
        </div>
      </div>

    </div>
  );
}
