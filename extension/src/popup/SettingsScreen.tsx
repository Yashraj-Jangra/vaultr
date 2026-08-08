import React, { useState } from "react";
import {
  Server, Lock, Info, Check, ExternalLink, User, Shield,
  Clock, Zap, ChevronRight
} from "lucide-react";
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

      {/* ── Account ───────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Account</div>

        <div
          className="account-card"
          onClick={() => openSite("/settings")}
          style={{ marginBottom: 8 }}
        >
          <div className="account-avatar">{initials}</div>
          <div className="account-meta">
            <div className="account-name">
              {accountInfo.name || accountInfo.email || "Vaultr User"}
            </div>
            {accountInfo.email && (
              <div className="account-email">{accountInfo.email}</div>
            )}
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
          onClick={() => openSite("/settings")}
        >
          <ExternalLink size={13} />
          Manage Account on Vaultr
        </button>
      </div>

      {/* ── Autofill ──────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Autofill</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Suggest credentials</div>
            <div className="settings-row-sub">Show Vaultr dropdown on login fields</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autofillEnabled}
              onChange={(e) => setAutofillEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-submit after fill</div>
            <div className="settings-row-sub">Automatically submit the form</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autofillSubmit}
              onChange={(e) => setAutofillSubmit(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Security</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-lock after</div>
            <div className="settings-row-sub">Lock vault when idle</div>
          </div>
          <select
            className="form-select"
            style={{ width: "auto", fontSize: 12, padding: "5px 8px" }}
            value={autoLockMinutes}
            onChange={(e) => setAutoLockMinutes(e.target.value)}
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
          style={{ marginTop: 8 }}
          onClick={onLock}
        >
          <Lock size={13} />
          Lock Vault Now
        </button>
      </div>

      {/* ── Connection ────────────────────────────────────────────────────── */}
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
                className={`server-save-btn${saved ? " saved" : ""}`}
              >
                {saved ? <Check size={12} /> : null}
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
          <ExternalLink size={12} />
          Open Vaultr Web App
        </button>
      </div>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="info-row">
          <Info size={14} />
          <span>
            <strong style={{ color: "var(--text-primary)" }}>Vaultr Extension v1.0.0</strong>
            <br />
            Zero-knowledge AES-256-GCM client-side encryption. Your master password never leaves your device.
          </span>
        </div>
      </div>
    </div>
  );
}
