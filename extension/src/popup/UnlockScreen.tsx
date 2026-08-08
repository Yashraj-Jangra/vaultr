import React, { useState } from "react";
import { Lock, KeyRound, AlertCircle, Server, LogIn, ExternalLink, Shield } from "lucide-react";

interface UnlockScreenProps {
  serverUrl: string;
  onUnlock: (password: string) => Promise<void>;
  onOpenSettings: () => void;
}

export function UnlockScreen({ serverUrl, onUnlock, onOpenSettings }: UnlockScreenProps) {
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;
    setLoading(true);
    setError("");
    setIsUnauthorized(false);

    try {
      await onUnlock(masterPassword);
    } catch (err: any) {
      const msg = err?.message || "Failed to unlock vault";
      setError(msg);
      if (
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("session") ||
        msg.toLowerCase().includes("401")
      ) {
        setIsUnauthorized(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const openLoginPage = () => {
    const loginUrl = `${serverUrl.replace(/\/+$/, "")}/auth`;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: loginUrl });
    } else {
      window.open(loginUrl, "_blank");
    }
  };

  if (isUnauthorized) {
    return (
      <div className="unlock-wrap animate-in">
        <div>
          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 22,
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <LogIn size={28} color="#f87171" />
          </div>

          <h2 className="unlock-title">Not signed in</h2>
          <p className="unlock-sub">
            You need to be logged in on the Vaultr web app before you can unlock the extension.
          </p>
        </div>

        {/* Server info */}
        <div style={{
          width: "100%", background: "var(--bg-raised)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", padding: "10px 12px"
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
            Server
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{serverUrl}</div>
        </div>

        <button className="btn-accent btn" style={{ width: "100%", padding: "11px", fontSize: 13 }} onClick={openLoginPage}>
          <ExternalLink size={14} />
          Open Vaultr & Sign In
        </button>

        <button
          className="link-btn"
          onClick={() => { setIsUnauthorized(false); setError(""); }}
          style={{ fontSize: 12 }}
        >
          ← Back to unlock
        </button>
      </div>
    );
  }

  return (
    <div className="unlock-wrap animate-in">
      {/* Logo */}
      <div>
        <div className="unlock-icon" style={{ margin: "0 auto 16px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: "linear-gradient(135deg, #7c6afa, #ec4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(124,106,250,0.4)"
          }}>
            <Shield size={20} color="#fff" />
          </div>
        </div>
        <h2 className="unlock-title">Vaultr is Locked</h2>
        <p className="unlock-sub">Enter your master password to unlock</p>
      </div>

      {/* Error */}
      {error && !isUnauthorized && (
        <div className="alert alert-error" style={{ width: "100%" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="unlock-form">
        <div className="form-group">
          <label className="form-label">Master Password</label>
          <div className="form-input-icon">
            <KeyRound size={15} />
            <input
              type="password"
              className="form-input"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary btn"
          disabled={loading || !masterPassword}
          style={{ marginTop: 4 }}
        >
          {loading ? "Unlocking…" : "Unlock Vault"}
        </button>
      </form>

      {/* Footer */}
      <div className="unlock-footer" style={{ width: "100%" }}>
        <span className="server-badge">
          <Server size={11} />
          {serverUrl}
        </span>
        <button className="link-btn" onClick={openLoginPage}>
          Sign in →
        </button>
      </div>
    </div>
  );
}
