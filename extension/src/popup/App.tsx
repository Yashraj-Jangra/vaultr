import React, { useState, useEffect } from "react";
import { VaultItem, isWebPageUrl } from "@vaultr/core";
import { UnlockScreen } from "./UnlockScreen";
import { VaultScreen } from "./VaultScreen";
import { GeneratorScreen } from "./GeneratorScreen";
import { SettingsScreen } from "./SettingsScreen";
import { NewEntryForm } from "./NewEntryForm";
import { KeyRound, Wand2, Settings, Lock, RefreshCw } from "lucide-react";
import "./popup.css";

export function resolveAvatarUrl(url?: string, serverUrl?: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const cleanServer = (serverUrl || "https://vaultr.cvweb.qzz.io").replace(/\/+$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${cleanServer}${cleanPath}`;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ color: "red", padding: 20, background: "#000", height: "100%", width: "100%", whiteSpace: "pre-wrap" }}>{this.state.error?.stack}</div>;
    }
    return this.props.children;
  }
}

type Tab = "vault" | "generator" | "settings";

export interface AccountInfo {
  email?: string;
  name?: string;
  image?: string | null;
}

export function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [serverUrl, setServerUrl] = useState("https://vaultr.cvweb.qzz.io");
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
        setServerUrl(res.serverUrl || "https://vaultr.cvweb.qzz.io");
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
        const mappedFolders = res.folders.map((f: any) => typeof f === "string" ? f : f.name);
        setFolders(mappedFolders);
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

  const handleDecryptItem = (encryptedBlobOrItem: string | { id?: string; encryptedBlob?: string }, itemId?: string): Promise<any> =>
    new Promise((resolve, reject) => {
      let blob = "";
      let id = itemId;

      if (typeof encryptedBlobOrItem === "object" && encryptedBlobOrItem !== null) {
        blob = encryptedBlobOrItem.encryptedBlob || "";
        id = encryptedBlobOrItem.id || itemId;
      } else {
        blob = encryptedBlobOrItem;
      }

      chrome.runtime.sendMessage({ type: "DECRYPT_ITEM", encryptedBlob: blob, itemId: id }, (res) => {
        const payload = res?.decrypted ?? res?.payload;
        if (payload) {
          resolve(payload);
        } else {
          reject(new Error(res?.error || "Failed to decrypt item"));
        }
      });
    });

  const handleAutofill = (cred: { username?: string; password?: string }) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id || !tabs[0]?.url) return;
      if (!isWebPageUrl(tabs[0].url)) return;
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

  const handleToggleFavorite = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item))
    );
    chrome.runtime.sendMessage({ type: "TOGGLE_FAVORITE", id }, (res) => {
      if (res?.success) {
        fetchItems();
      }
    });
  };

  const avatarUri = resolveAvatarUrl(accountInfo.image || (accountInfo as any).avatarUrl, serverUrl);

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <div className="header-brand">
          <img
            src="brand/vaultr-full-dark-transparent.png"
            alt="Vaultr"
            style={{ height: 20, width: "auto", objectFit: "contain", opacity: 0.9 }}
          />
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
            {avatarUri ? (
              <div className="avatar-circle">
                <img src={avatarUri} alt="" />
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
            onToggleFavorite={handleToggleFavorite}
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
        {(isNewEntryOpen || editingItem) && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#09090b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ErrorBoundary>
              <NewEntryForm
                folders={folders}
                onSave={handleSaveItem}
                onCancel={() => {
                  setIsNewEntryOpen(false);
                  setEditingItem(null);
                }}
                initialData={editingItem || undefined}
              />
            </ErrorBoundary>
          </div>
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
