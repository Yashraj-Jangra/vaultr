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
        <div className="unlock-bg-grid" />
        <div className="unlock-bg-radial" />

        <div style={{ textAlign: "center", position: "relative", zIndex: 10 }}>
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
      {/* Decorative Grid & Glow matching site exactly */}
      <div className="unlock-bg-grid" />
      <div className="unlock-bg-radial" />

      {/* Lock Halo Visual */}
      <div className="lock-halo-wrap">
        <div className="lock-halo" />
        <div className={`lock-box${loading ? " unlocking" : ""}`}>
          <img
            src="brand/lock-brand-dark.png"
            alt="Vaultr Lock"
            style={{
              width: 48,
              height: 48,
              objectFit: "contain",
              opacity: loading ? 1 : 0.6,
              transition: "all 0.3s ease"
            }}
          />
        </div>
      </div>

      {/* Header Info */}
      <div className="unlock-header" style={{ position: "relative", zIndex: 10, textAlign: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, opacity: 0.6 }}>
          <img
            src="brand/logo-dark.png"
            alt="Vaultr"
            style={{ height: 20, width: "auto", objectFit: "contain" }}
          />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--neutral-100)", letterSpacing: "-0.025em" }}>
          {loading ? "Decrypting vault…" : "Unlock your vault"}
        </h1>
        {userEmail && (
          <p style={{ fontSize: 12, color: "var(--neutral-500)", fontFamily: "monospace", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260, margin: "4px auto 0" }}>
            {userEmail}
          </p>
        )}
      </div>

      {/* Inputs & Form */}
      <div style={{ width: "100%", position: "relative", zIndex: 10 }}>
        <div key={shakeKey} className={`unlock-form ${error && shakeKey > 0 ? "animate-shake" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div className="alert-error animate-auth-form-in">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 4 }} />
              <p style={{ fontSize: 12, color: "#f87171", margin: 0, lineHeight: 1.4, flex: 1 }}>{error}</p>
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
              style={{
                width: "100%",
                height: 44,
                paddingRight: 40,
                background: "#0d0d0d",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--neutral-200)",
                fontSize: 13
              }}
            />
            <Lock size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--neutral-700)", pointerEvents: "none" }} />
          </div>

          <button
            onClick={() => handleSubmit()}
            className="btn btn-primary"
            disabled={!masterPassword || loading}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 500
            }}
          >
            {loading ? (
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Lock size={14} />
                Unlock vault
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer Links matching site */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, fontSize: 12, position: "relative", zIndex: 10 }}>
        <button
          onClick={openLoginPage}
          style={{ background: "none", border: "none", color: "var(--neutral-600)", cursor: "pointer", fontSize: 12 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-300)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neutral-600)")}
        >
          Forgot password?
        </button>
        <button
          onClick={openLoginPage}
          style={{ background: "none", border: "none", color: "var(--neutral-600)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-300)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neutral-600)")}
        >
          <Shield size={14} /> Why is this needed?
        </button>
      </div>
    </div>
  );
}
