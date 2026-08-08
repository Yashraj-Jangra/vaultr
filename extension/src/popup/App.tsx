import React, { useState, useEffect } from "react";
import { VaultItem } from "@vaultr/core";
import { UnlockScreen } from "./UnlockScreen";
import { VaultScreen } from "./VaultScreen";
import { GeneratorScreen } from "./GeneratorScreen";
import { SettingsScreen } from "./SettingsScreen";
import { KeyRound, Shuffle, Settings, Lock, Shield } from "lucide-react";
import "./popup.css";

type Tab = "vault" | "generator" | "settings";

export interface AccountInfo {
  email?: string;
  name?: string;
}

export function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({});

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (chrome.runtime.lastError) { setLoading(false); return; }
      if (res) {
        setIsUnlocked(res.isUnlocked);
        setServerUrl(res.serverUrl || "http://localhost:3000");
        if (res.isUnlocked) {
          fetchItems();
          fetchAccountInfo();
        }
      }
      setLoading(false);
    });
  }, []);

  const fetchItems = () => {
    chrome.runtime.sendMessage({ type: "GET_ITEMS" }, (res) => {
      if (res?.items) setItems(res.items);
    });
  };

  const fetchAccountInfo = () => {
    chrome.runtime.sendMessage({ type: "GET_ACCOUNT_INFO" }, (res) => {
      if (res?.account) setAccountInfo(res.account);
    });
  };

  const handleUnlock = (password: string): Promise<void> =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "UNLOCK", masterPassword: password }, (res) => {
        if (res?.success) {
          setIsUnlocked(true);
          fetchItems();
          fetchAccountInfo();
          resolve();
        } else {
          reject(new Error(res?.error || "Incorrect master password"));
        }
      });
    });

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: "LOCK" }, () => {
      setIsUnlocked(false);
      setItems([]);
      setAccountInfo({});
    });
  };

  const handleUpdateServerUrl = (url: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: url }, () => {
        setServerUrl(url);
        resolve();
      });
    });

  const handleDecryptItem = (encryptedBlob: string): Promise<any> =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "DECRYPT_ITEM", encryptedBlob }, (res) => {
        if (res?.payload) resolve(res.payload);
        else reject(new Error(res?.error || "Failed to decrypt"));
      });
    });

  const handleAutofill = (cred: { username?: string; password?: string }) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "AUTOFILL_CREDENTIAL", credential: cred });
    });
    // Close popup after autofill
    window.close();
  };

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        Loading Vaultr...
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <UnlockScreen
        serverUrl={serverUrl}
        onUnlock={handleUnlock}
        onOpenSettings={() => {}} // settings inaccessible when locked
      />
    );
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <div className="header-brand">
          <div className="header-logo">
            <Shield size={14} color="#fff" />
          </div>
          <span className="header-title">Vaultr</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={handleLock}
            title="Lock Vault"
          >
            <Lock size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "vault" && (
          <VaultScreen
            items={items}
            onDecryptItem={handleDecryptItem}
            onAutofill={handleAutofill}
          />
        )}
        {activeTab === "generator" && <GeneratorScreen />}
        {activeTab === "settings" && (
          <SettingsScreen
            serverUrl={serverUrl}
            accountInfo={accountInfo}
            onUpdateServerUrl={handleUpdateServerUrl}
            onLock={handleLock}
          />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <button
          className={`nav-btn${activeTab === "vault" ? " active" : ""}`}
          onClick={() => setActiveTab("vault")}
        >
          <KeyRound size={16} />
          <span>Vault</span>
        </button>
        <button
          className={`nav-btn${activeTab === "generator" ? " active" : ""}`}
          onClick={() => setActiveTab("generator")}
        >
          <Shuffle size={16} />
          <span>Generate</span>
        </button>
        <button
          className={`nav-btn${activeTab === "settings" ? " active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
