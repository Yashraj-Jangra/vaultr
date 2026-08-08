import React, { useState } from "react";
import { Lock, LogIn, ExternalLink, Shield } from "lucide-react";

interface UnlockScreenProps {
  serverUrl: string;
  userEmail?: string;
  onUnlock: (password: string) => Promise<void>;
}

export function UnlockScreen({ serverUrl, userEmail, onUnlock }: UnlockScreenProps) {
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!masterPassword || loading) return;

    setLoading(true);
    setError("");

    try {
      await onUnlock(masterPassword);
    } catch (err: any) {
      const msg = err?.message || "Incorrect master password";
      setError(msg);
      setShakeKey((k) => k + 1);

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
      <div className="unlock-wrap" style={{ justifyContent: "center", gap: 24 }}>
        {/* Background Grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.015,
            pointerEvents: "none",
          }}
        />

        <div style={{ textAlign: "center" }}>
          {/* Locked Avatar style Icon */}
          <div className="lock-halo-wrap">
            <div className="lock-halo" style={{ background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)" }} />
            <div className="lock-box" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.02)" }}>
              <LogIn size={32} className="text-red-400" />
            </div>
          </div>

          <h2 className="unlock-title" style={{ fontSize: 16 }}>Unauthorized</h2>
          <p className="unlock-email" style={{ color: "var(--neutral-500)", marginTop: 6, padding: "0 12px", fontFamily: "inherit" }}>
            Please sign in to your Vaultr account in the browser to unlock the extension.
          </p>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, zIndex: 10 }}>
          <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }} onClick={openLoginPage}>
            <ExternalLink size={14} style={{ marginRight: 4 }} />
            Open Vaultr & Sign In
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", padding: "10px" }}
            onClick={() => { setIsUnauthorized(false); setError(""); }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="unlock-wrap">
      {/* Background Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.012,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Lock Halo Visual */}
      <div className="lock-halo-wrap">
        <div className="lock-halo" />
        <div className="lock-box">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="url(#logo-grad-sw)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 8px rgba(124, 106, 250, 0.4))" }}>
            <defs>
              <linearGradient id="logo-grad-sw" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c6afa" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
      </div>

      {/* Header Info */}
      <div className="unlock-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: 0.7, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--neutral-500)" }}>Vaultr</span>
        </div>
        <h1 className="unlock-title">
          {loading ? "Decrypting vault…" : "Unlock your vault"}
        </h1>
        {userEmail && <p className="unlock-email">{userEmail}</p>}
      </div>

      {/* Inputs & Form */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <div key={shakeKey} className={`unlock-form ${error && shakeKey > 0 ? "animate-shake" : ""}`}>
          {error && (
            <div className="alert alert-error" style={{ width: "100%" }}>
              {error}
            </div>
          )}

          <div style={{ position: "relative" }}>
            <input
              type="password"
              className="form-input"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Master password"
              autoFocus
              disabled={loading}
              style={{ paddingRight: 40, height: 44 }}
            />
            <Lock size={15} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--neutral-700)" }} />
          </div>

          <button
            onClick={() => handleSubmit()}
            className="btn btn-primary"
            style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            disabled={!masterPassword || loading}
          >
            {loading ? (
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            ) : (
              "Unlock Vault"
            )}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="unlock-footer">
        <span className="unlock-footer-link" onClick={openLoginPage}>
          Sign in
        </span>
        <span className="unlock-footer-link" style={{ cursor: "default" }}>
          {serverUrl.replace(/^https?:\/\//, "")}
        </span>
      </div>
    </div>
  );
}
