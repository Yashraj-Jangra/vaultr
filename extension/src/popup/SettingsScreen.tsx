import React, { useState, useEffect } from "react";
import { Server, Lock, Info, Check, ExternalLink, ChevronRight } from "lucide-react";
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
  
  // Local settings persisted via chrome.storage.local
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
    // Inform background script of auto-lock changes
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "SET_AUTO_LOCK", minutes: Number(val) });
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
    <div className="screen-body">

      {/* Account Info */}
      <div className="settings-section">
        <div className="settings-section-title">Account</div>
        <div
          className="account-card"
          onClick={() => openSite("/settings")}
          style={{ marginBottom: 8 }}
        >
          {accountInfo.image ? (
            <div className="avatar-circle" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <img src={accountInfo.image} alt="" />
            </div>
          ) : (
            <div className="account-avatar">{initials}</div>
          )}
          <div className="account-meta">
            <div className="account-name">
              {accountInfo.name || accountInfo.email || "Vaultr User"}
            </div>
            {accountInfo.email && (
              <div className="account-email">{accountInfo.email}</div>
            )}
          </div>
          <ChevronRight size={14} style={{ color: "var(--neutral-600)" }} />
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "8px" }}
          onClick={() => openSite("/settings")}
        >
          <ExternalLink size={13} style={{ marginRight: 4 }} />
          Manage Account on Vaultr
        </button>
      </div>

      {/* Autofill Preferences */}
      <div className="settings-section">
        <div className="settings-section-title">Autofill</div>

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

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-submit after fill</div>
            <div className="settings-row-sub">Automatically submit login forms</div>
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

      {/* Security Actions */}
      <div className="settings-section">
        <div className="settings-section-title">Security</div>

        <div className="settings-row" style={{ marginBottom: 8 }}>
          <div>
            <div className="settings-row-label">Auto-lock timeout</div>
            <div className="settings-row-sub">Lock vault when inactive</div>
          </div>
          <select
            className="form-select"
            style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
            value={autoLockMinutes}
            onChange={(e) => handleAutolockChange(e.target.value)}
          >
            <option value="5">5 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="0">Never</option>
          </select>
        </div>

        <button
          className="btn btn-danger"
          style={{ width: "100%", justifyContent: "center", padding: "10px" }}
          onClick={onLock}
        >
          <Lock size={13} style={{ marginRight: 4 }} />
          Lock Vault Now
        </button>
      </div>

      {/* Connection & Server URL */}
      <div className="settings-section">
        <div className="settings-section-title">Connection</div>
        <form onSubmit={handleSaveUrl}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Vaultr Server URL</label>
            <div className="server-input-row">
              <input
                type="text"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000"
                style={{ fontSize: 12 }}
              />
              <button
                type="submit"
                className={`btn btn-primary${saved ? " btn-success" : ""}`}
                style={{ padding: "8px 12px" }}
              >
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </form>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
          onClick={() => openSite()}
        >
          <ExternalLink size={12} style={{ marginRight: 4 }} />
          Open Vaultr Web App
        </button>
      </div>

      {/* About Box */}
      <div className="settings-section" style={{ borderBottom: "none" }}>
        <div className="info-row" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <Info size={14} style={{ color: "var(--neutral-500)" }} />
          <span style={{ color: "var(--neutral-400)" }}>
            <strong style={{ color: "var(--neutral-200)" }}>Vaultr Extension v1.0.0</strong>
            <br />
            Zero-knowledge AES-256-GCM client-side encryption. Your master password never leaves your device.
          </span>
        </div>
      </div>
    </div>
  );
}
