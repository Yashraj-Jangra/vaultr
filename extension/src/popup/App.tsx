import React, { useState, useEffect } from "react";
import { VaultItem } from "@vaultr/core";
import { UnlockScreen } from "./UnlockScreen";
import { VaultScreen } from "./VaultScreen";
import { GeneratorScreen } from "./GeneratorScreen";
import { SettingsScreen } from "./SettingsScreen";
import { KeyRound, Shield, RefreshCw, Settings, Lock } from "lucide-react";

type Tab = "vault" | "generator" | "settings";

export function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query background service worker for status
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (chrome.runtime.lastError) {
        setLoading(false);
        return;
      }
      if (res) {
        setIsUnlocked(res.isUnlocked);
        setServerUrl(res.serverUrl || "http://localhost:3000");
        if (res.isUnlocked) {
          fetchItems();
        }
      }
      setLoading(false);
    });
  }, []);

  const fetchItems = () => {
    chrome.runtime.sendMessage({ type: "GET_ITEMS" }, (res) => {
      if (res && res.items) {
        setItems(res.items);
      }
    });
  };

  const handleUnlock = async (password: string) => {
    return new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "UNLOCK", masterPassword: password }, (res) => {
        if (res?.success) {
          setIsUnlocked(true);
          fetchItems();
          resolve();
        } else {
          reject(new Error(res?.error || "Incorrect master password"));
        }
      });
    });
  };

  const handleLock = async () => {
    chrome.runtime.sendMessage({ type: "LOCK" }, () => {
      setIsUnlocked(false);
      setItems([]);
    });
  };

  const handleUpdateServerUrl = async (url: string) => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: url }, () => {
        setServerUrl(url);
        resolve();
      });
    });
  };

  const handleDecryptItem = async (encryptedBlob: string) => {
    return new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "DECRYPT_ITEM", encryptedBlob }, (res) => {
        if (res?.payload) {
          resolve(res.payload);
        } else {
          reject(new Error(res?.error || "Failed to decrypt"));
        }
      });
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#71717a", fontSize: "12px" }}>
        Loading Vaultr...
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <UnlockScreen
        serverUrl={serverUrl}
        onUnlock={handleUnlock}
        onOpenSettings={() => setActiveTab("settings")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#09090b", color: "#f4f4f5" }}>
      {/* Top Navigation Bar */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f0f11" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "8px", background: "linear-gradient(135deg, #8b5cf6, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={14} color="#ffffff" />
          </div>
          <span style={{ fontWeight: 600, fontSize: "14px", letterSpacing: "-0.2px" }}>Vaultr</span>
        </div>

        <button
          onClick={handleLock}
          title="Lock Vault"
          style={{ background: "#18181b", border: "1px solid #27272a", color: "#a1a1aa", width: "28px", height: "28px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <Lock size={13} />
        </button>
      </div>

      {/* Main Screen Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "vault" && <VaultScreen items={items} onDecryptItem={handleDecryptItem} />}
        {activeTab === "generator" && <GeneratorScreen />}
        {activeTab === "settings" && <SettingsScreen serverUrl={serverUrl} onUpdateServerUrl={handleUpdateServerUrl} onLock={handleLock} />}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ height: "48px", borderTop: "1px solid #18181b", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#0f0f11" }}>
        <TabButton active={activeTab === "vault"} onClick={() => setActiveTab("vault")} icon={<KeyRound size={16} />} label="Vault" />
        <TabButton active={activeTab === "generator"} onClick={() => setActiveTab("generator")} icon={<RefreshCw size={16} />} label="Generator" />
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<Settings size={16} />} label="Settings" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: active ? "#a78bfa" : "#71717a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        fontSize: "10px",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "color 0.15s ease",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
