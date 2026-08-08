import React, { useState } from "react";
import { Lock, KeyRound, AlertCircle, Server, LogIn, ExternalLink } from "lucide-react";

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
      const errMsg = err?.message || "Failed to unlock vault";
      setError(errMsg);
      if (errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("session") || errMsg.toLowerCase().includes("401")) {
        setIsUnauthorized(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogin = () => {
    const loginUrl = `${serverUrl.replace(/\/+$/, "")}/auth`;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: loginUrl });
    } else {
      window.open(loginUrl, "_blank");
    }
  };

  if (isUnauthorized) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", justifyContent: "space-between" }}>
        <div>
          <div style={{ textAlign: "center", marginTop: "16px", marginBottom: "20px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "18px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              <LogIn size={26} />
            </div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#f4f4f5" }}>Please Sign In First</h2>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#a1a1aa", lineHeight: "1.5" }}>
              You are not logged in on the Vaultr web app. Please sign in to your account on the website first.
            </p>
          </div>

          <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Server Target</div>
            <div style={{ fontSize: "12px", color: "#f4f4f5", fontWeight: 500 }}>{serverUrl}</div>
          </div>

          <button
            type="button"
            onClick={handleOpenLogin}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: "#8b5cf6",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
            }}
          >
            <span>Open Vaultr Web App to Sign In</span>
            <ExternalLink size={14} />
          </button>
        </div>

        <div style={{ borderTop: "1px solid #18181b", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
          <button
            onClick={() => { setIsUnauthorized(false); setError(""); }}
            style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "11px", cursor: "pointer", padding: 0 }}
          >
            ← Back to Unlock
          </button>
          <button
            onClick={onOpenSettings}
            style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "11px", cursor: "pointer", padding: 0 }}
          >
            Change Server
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", justifyContent: "space-between" }}>
      <div>
        <div style={{ textAlign: "center", marginTop: "16px", marginBottom: "24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "16px", background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Lock size={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#f4f4f5" }}>Vaultr is Locked</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#a1a1aa" }}>Enter master password to access your vault</p>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "#a1a1aa", marginBottom: "4px" }}>Master Password</label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px 10px 36px",
                  borderRadius: "10px",
                  border: "1px solid #27272a",
                  background: "#18181b",
                  color: "#f4f4f5",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <KeyRound size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#71717a" }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !masterPassword}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              border: "none",
              background: loading || !masterPassword ? "#27272a" : "#f4f4f5",
              color: loading || !masterPassword ? "#71717a" : "#09090b",
              fontWeight: 600,
              fontSize: "13px",
              cursor: loading || !masterPassword ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? "Unlocking..." : "Unlock Vault"}
          </button>
        </form>
      </div>

      <div style={{ borderTop: "1px solid #18181b", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#71717a" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Server size={12} />
          {serverUrl}
        </span>
        <button
          onClick={onOpenSettings}
          style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "11px", cursor: "pointer", padding: 0 }}
        >
          Change Server
        </button>
      </div>
    </div>
  );
}
