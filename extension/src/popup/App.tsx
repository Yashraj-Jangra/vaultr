import React, { useState, useEffect } from "react";
import { VaultItem } from "@vaultr/core";
import { UnlockScreen } from "./UnlockScreen";
import { VaultScreen } from "./VaultScreen";
import { GeneratorScreen } from "./GeneratorScreen";
import { SettingsScreen } from "./SettingsScreen";
import { NewEntryForm } from "./NewEntryForm";
import { KeyRound, Wand2, Settings, Lock, RefreshCw } from "lucide-react";
import "./popup.css";

type Tab = "vault" | "generator" | "settings";

export interface AccountInfo {
  email?: string;
  name?: string;
  image?: string | null;
}

export function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({});

  // Overlay forms
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    folder?: string;
    tags?: string[];
    template: any;
    payload: any;
  } | null>(null);

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
      if (res?.items) {
        setItems(res.items);
      }
    });
    chrome.runtime.sendMessage({ type: "GET_FOLDERS" }, (res) => {
      if (res?.folders) {
        setFolders(res.folders);
      }
    });
  };

  const fetchAccountInfo = () => {
    chrome.runtime.sendMessage({ type: "GET_ACCOUNT_INFO" }, (res) => {
      if (res?.account) {
        setAccountInfo(res.account);
      }
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
      setFolders([]);
      setAccountInfo({});
      setIsNewEntryOpen(false);
      setEditingItem(null);
    });
  };

  const handleUpdateServerUrl = (url: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: url }, () => {
        setServerUrl(url);
        resolve();
      });
    });

  const handleDecryptItem = (encryptedBlob: string, itemId?: string): Promise<any> =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "DECRYPT_ITEM", encryptedBlob, itemId }, (res) => {
        if (res?.payload) resolve(res.payload);
        else reject(new Error(res?.error || "Failed to decrypt"));
      });
    });

  const handleAutofill = (cred: { username?: string; password?: string }) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "AUTOFILL_CREDENTIAL", credential: cred });
    });
    window.close();
  };

  const handleSaveItem = async (
    name: string,
    template: any,
    folder: string,
    tags: string[],
    payload: any,
    editId?: string
  ) => {
    const type = editId ? "UPDATE_ITEM" : "SAVE_ITEM";
    const msg = editId
      ? { type, id: editId, name, template, folder, tags, payload }
      : { type, name, template, folder, tags, payload };

    return new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (res?.success) {
          fetchItems();
          setIsNewEntryOpen(false);
          setEditingItem(null);
          resolve();
        } else {
          reject(new Error(res?.error || "Failed to save item"));
        }
      });
    });
  };

  const handleDeleteItem = async (id: string) => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "DELETE_ITEM", id }, () => {
        fetchItems();
        resolve();
      });
    });
  };

  const handleEditTrigger = async (item: VaultItem, decryptedPayload: any) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      folder: item.folder,
      tags: item.tags,
      template: item.template || "login",
      payload: decryptedPayload,
    });
  };

  const handleRefresh = () => {
    fetchItems();
    fetchAccountInfo();
  };

  const initials = accountInfo.name
    ? accountInfo.name.slice(0, 2).toUpperCase()
    : accountInfo.email
    ? accountInfo.email.slice(0, 2).toUpperCase()
    : "VA";

  if (loading) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        <span className="spinner" style={{ width: 20, height: 20 }} />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <UnlockScreen
        serverUrl={serverUrl}
        userEmail={accountInfo.email}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <div className="header-brand">
          <div className="header-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#logo-grad-sw2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 4px rgba(124, 106, 250, 0.45))" }}>
              <defs>
                <linearGradient id="logo-grad-sw2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c6afa" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="header-title">Vaultr</span>
        </div>
        <div className="header-actions">
          {/* Refresh */}
          <button className="detail-action-btn" onClick={handleRefresh} title="Sync Vault">
            <RefreshCw size={14} />
          </button>
          {/* Lock */}
          <button className="detail-action-btn" onClick={handleLock} title="Lock Vault">
            <Lock size={14} />
          </button>
          {/* Avatar Linking to Settings Tab */}
          <button
            style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}
            onClick={() => setActiveTab("settings")}
            title="Account Settings"
          >
            {accountInfo.image ? (
              <div className="avatar-circle">
                <img src={accountInfo.image} alt="" />
              </div>
            ) : (
              <div className="avatar-circle">{initials}</div>
            )}
          </button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {activeTab === "vault" && (
          <VaultScreen
            items={items}
            onDecryptItem={(blob) => handleDecryptItem(blob)}
            onAutofill={handleAutofill}
            onEditItem={handleEditTrigger}
            onDeleteItem={handleDeleteItem}
            onAddNew={() => setIsNewEntryOpen(true)}
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

        {/* Slide-up overlays */}
        {isNewEntryOpen && (
          <NewEntryForm
            folders={folders}
            onSave={handleSaveItem}
            onCancel={() => setIsNewEntryOpen(false)}
          />
        )}
        {editingItem && (
          <NewEntryForm
            folders={folders}
            onSave={handleSaveItem}
            onCancel={() => setEditingItem(null)}
            initialData={editingItem}
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
          <Wand2 size={16} />
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
