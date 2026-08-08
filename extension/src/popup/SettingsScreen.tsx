import React, { useState } from "react";
import { Server, Lock, Info, Check } from "lucide-react";

interface SettingsScreenProps {
  serverUrl: string;
  onUpdateServerUrl: (url: string) => Promise<void>;
  onLock: () => Promise<void>;
}

export function SettingsScreen({ serverUrl, onUpdateServerUrl, onLock }: SettingsScreenProps) {
  const [url, setUrl] = useState(serverUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: 500, color: "#a1a1aa" }}>Vaultr Server URL</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #27272a",
              background: "#18181b",
              color: "#f4f4f5",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              background: saved ? "#22c55e" : "#8b5cf6",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {saved ? <Check size={12} /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </form>

      <div style={{ borderTop: "1px solid #18181b", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          onClick={onLock}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#f87171",
            fontWeight: 600,
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Lock size={14} />
          Lock Vault Now
        </button>
      </div>

      <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "10px", padding: "12px", fontSize: "11px", color: "#a1a1aa", display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <Info size={14} style={{ color: "#a78bfa", marginTop: "2px", flexShrink: 0 }} />
        <span>Vaultr Extension v1.0.0 — Zero-knowledge AES-256-GCM client-side encryption.</span>
      </div>
    </div>
  );
}
