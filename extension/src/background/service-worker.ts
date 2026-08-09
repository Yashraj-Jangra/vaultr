/**
 * Vaultr MV3 Extension Background Service Worker
 * Handles secure session caching, server communication, domain matching, auto-lock timers, and session restoration.
 */

import { VaultrApiClient, decrypt, encrypt, deriveKey, VaultItem, DecryptedLoginPayload, isWebPageUrl, isInternalBrowserHost } from "@vaultr/core";

const DEFAULT_SERVER_URL = "http://localhost:3000";

interface ServiceWorkerState {
  serverUrl: string;
  masterPassword: string | null;
  userId: string | null;
  items: VaultItem[];
  decryptedItemsCache: Record<string, any>;
  isUnlocked: boolean;
  accountInfo: { email?: string; name?: string; image?: string | null } | null;
}

const state: ServiceWorkerState = {
  serverUrl: DEFAULT_SERVER_URL,
  masterPassword: null,
  userId: null,
  items: [],
  decryptedItemsCache: {},
  isUnlocked: false,
  accountInfo: null,
};

// Initialize server URL from local storage
chrome.storage.local.get(["vaultr_server_url", "autolock_minutes"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
  touchAutoLock(result.autolock_minutes || "15");
});

// Auto-lock alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "vaultr_autolock") {
    lockVault();
  }
});

async function touchAutoLock(setting?: string) {
  const current = setting ?? (await chrome.storage.local.get("autolock_minutes")).autolock_minutes ?? "15";
  const num = Number(current);
  if (!isNaN(num) && num > 0) {
    const expiry = Date.now() + num * 60 * 1000;
    await chrome.storage.local.set({ autolock_expiry: expiry });
    chrome.alarms.clear("vaultr_autolock");
    chrome.alarms.create("vaultr_autolock", { delayInMinutes: num });
  } else {
    chrome.alarms.clear("vaultr_autolock");
    await chrome.storage.local.remove("autolock_expiry");
  }
}

function lockVault() {
  state.masterPassword = null;
  state.userId = null;
  state.items = [];
  state.decryptedItemsCache = {};
  state.isUnlocked = false;
  state.accountInfo = null;
  chrome.storage.session.remove(["vaultr_master_password"]);
  chrome.storage.local.remove(["vaultr_master_password_persisted", "autolock_expiry"]);
  chrome.alarms.clear("vaultr_autolock");
  console.log("[Vaultr SW] Vault locked.");
}

async function getApiClient(): Promise<VaultrApiClient> {
  const { vaultr_server_url } = await chrome.storage.local.get("vaultr_server_url");
  return new VaultrApiClient({ baseUrl: vaultr_server_url || DEFAULT_SERVER_URL });
}

// Helper to restore session from session storage or local storage if valid
async function tryRestoreSession(): Promise<boolean> {
  if (state.isUnlocked && state.masterPassword) {
    const local = await chrome.storage.local.get("autolock_minutes");
    await touchAutoLock(local.autolock_minutes);
    return true;
  }

  try {
    const local = await chrome.storage.local.get([
      "vaultr_server_url",
      "autolock_minutes",
      "autolock_expiry",
      "vaultr_master_password_persisted"
    ]);
    const session = await chrome.storage.session.get("vaultr_master_password");

    const lockSetting = String(local.autolock_minutes ?? "15");
    const storedPw = session.vaultr_master_password || (lockSetting === "0" ? local.vaultr_master_password_persisted : null);

    if (!storedPw) return false;

    // Check time-based expiration
    if (!isNaN(Number(lockSetting)) && Number(lockSetting) > 0) {
      if (local.autolock_expiry && Date.now() > Number(local.autolock_expiry)) {
        lockVault();
        return false;
      }
    }

    const api = await getApiClient();
    let userId = "";

    try {
      const meRes = await globalThis.fetch(`${state.serverUrl}/api/me`, { credentials: "include" });
      if (meRes.ok) {
        const data = await meRes.json();
        state.accountInfo = { email: data.email, name: data.name, image: data.image };
        userId = data.id;
      }
    } catch {}

    if (!userId) {
      // User logged out of device / web session expired
      lockVault();
      return false;
    }

    const items = await api.getItems();
    const key = await deriveKey(storedPw, userId);

    // Validate master password against latest active item
    const activeItems = items
      .filter((i) => !i.deletedAt && i.encryptedBlob)
      .sort((a, b) => {
        const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tB - tA;
      });

    const testItems = activeItems.length > 0 ? activeItems : items.filter((i) => i.encryptedBlob);

    if (testItems.length > 0) {
      const raw = await decrypt(key, testItems[0].encryptedBlob);
      if (!raw) {
        lockVault();
        return false;
      }
    }

    state.masterPassword = storedPw;
    state.userId = userId;
    state.items = items;
    state.isUnlocked = true;

    await touchAutoLock(lockSetting);
    return true;
  } catch (err) {
    console.error("[Vaultr SW] Session restoration failed:", err);
    lockVault();
    return false;
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {

        case "GET_STATUS": {
          await tryRestoreSession();
          sendResponse({
            isUnlocked: state.isUnlocked,
            serverUrl: state.serverUrl,
            itemCount: state.items.length,
          });
          break;
        }

        case "SET_SERVER_URL": {
          state.serverUrl = message.serverUrl;
          await chrome.storage.local.set({ vaultr_server_url: message.serverUrl });
          sendResponse({ success: true });
          break;
        }

        case "SET_AUTO_LOCK": {
          const setting = String(message.minutes ?? "15");
          await chrome.storage.local.set({ autolock_minutes: setting });

          if (setting === "0" && state.masterPassword) {
            await chrome.storage.local.set({ vaultr_master_password_persisted: state.masterPassword });
          } else {
            await chrome.storage.local.remove("vaultr_master_password_persisted");
          }

          await touchAutoLock(setting);
          sendResponse({ success: true });
          break;
        }

        case "UNLOCK": {
          const { masterPassword } = message;
          const api = await getApiClient();

          // Fetch items from server (validates session cookie)
          let items: VaultItem[] = [];
          try {
            items = await api.getItems();
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to fetch vault items" });
            return;
          }

          // Fetch account info from the server to get user ID for salt
          let userId = "";
          try {
            const accountRes = await globalThis.fetch(`${state.serverUrl}/api/me`, {
              credentials: "include",
            });
            if (accountRes.ok) {
              const data = await accountRes.json();
              state.accountInfo = { email: data.email, name: data.name, image: data.image };
              userId = data.id;
            }
          } catch (e) {
            console.error("[Vaultr SW] Fetch account on unlock failed:", e);
          }

          if (!userId) {
            sendResponse({ error: "Failed to retrieve user identity for decryption." });
            return;
          }

          // Derive encryption key using user.id as salt (matching site exactly)
          const key = await deriveKey(masterPassword, userId);

          // Validate master password correctness against the latest active vault item
          const activeItems = items
            .filter((i) => !i.deletedAt && i.encryptedBlob)
            .sort((a, b) => {
              const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
              const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
              return tB - tA;
            });

          const testItems = activeItems.length > 0 ? activeItems : items.filter((i) => i.encryptedBlob);

          if (testItems.length > 0) {
            const testItem = testItems[0];
            try {
              const raw = await decrypt(key, testItem.encryptedBlob);
              if (raw) {
                try {
                  state.decryptedItemsCache[testItem.id] = JSON.parse(raw);
                } catch {}
              } else {
                sendResponse({ error: "Wrong master password." });
                return;
              }
            } catch {
              sendResponse({ error: "Wrong master password." });
              return;
            }
          }

          state.masterPassword = masterPassword;
          state.userId = userId;
          state.items = items;
          state.isUnlocked = true;

          // Save password to session storage
          await chrome.storage.session.set({ vaultr_master_password: masterPassword });

          const lockRes = await chrome.storage.local.get("autolock_minutes");
          const setting = String(lockRes.autolock_minutes ?? "15");

          if (setting === "0") {
            await chrome.storage.local.set({ vaultr_master_password_persisted: masterPassword });
          } else {
            await chrome.storage.local.remove("vaultr_master_password_persisted");
          }

          await touchAutoLock(setting);

          sendResponse({ success: true, count: items.length });
          break;
        }

        case "LOCK": {
          lockVault();
          sendResponse({ success: true });
          break;
        }

        case "GET_ITEMS": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          sendResponse({ items: state.items });
          break;
        }

        case "GET_ACCOUNT_INFO": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ account: null });
            return;
          }
          if (state.accountInfo) {
            sendResponse({ account: state.accountInfo });
            return;
          }
          try {
            const res = await globalThis.fetch(`${state.serverUrl}/api/me`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              state.accountInfo = { email: data.email, name: data.name, image: data.image };
              sendResponse({ account: state.accountInfo });
            } else {
              sendResponse({ account: {} });
            }
          } catch {
            sendResponse({ account: {} });
          }
          break;
        }

function extractDomainHost(rawUrlOrDomain?: string): string {
  if (!rawUrlOrDomain || !rawUrlOrDomain.trim()) return "";
  let clean = rawUrlOrDomain.trim().toLowerCase();

  // Filter out internal browser pages (newtab, chrome://, edge://, about:blank, etc.)
  if (isInternalBrowserHost(clean) || (clean.includes("://") && !isWebPageUrl(clean))) {
    return "";
  }

  if (clean.includes("://")) {
    try {
      clean = new URL(clean).hostname;
    } catch {
      clean = clean.split("://")[1] || clean;
    }
  }

  clean = clean.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  clean = clean.replace(/^www\./, "");

  if (isInternalBrowserHost(clean)) return "";
  return clean;
}

function getBaseRootDomain(hostname: string): string {
  if (!hostname) return "";
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

        case "GET_LOGINS_FOR_DOMAIN": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ logins: [] });
            return;
          }

          const currentHost = extractDomainHost(message.domain);
          if (!currentHost) {
            sendResponse({ logins: [] });
            return;
          }

          const currentRoot = getBaseRootDomain(currentHost);
          const key = await deriveKey(state.masterPassword, state.userId || "");

          const matches: Array<{
            id: string;
            name: string;
            username?: string;
            password?: string;
            score: number;
          }> = [];

          for (const item of state.items) {
            if (item.deletedAt) continue;
            const template = item.template || "login";
            if (template !== "login") continue;

            let decrypted = state.decryptedItemsCache[item.id];
            if (!decrypted) {
              try {
                const raw = await decrypt(key, item.encryptedBlob);
                decrypted = JSON.parse(raw) as DecryptedLoginPayload;
                state.decryptedItemsCache[item.id] = decrypted;
              } catch (err) {
                console.error("[Vaultr SW] Decrypt error:", item.id, err);
                continue;
              }
            }

            if (!decrypted.username && !decrypted.password) continue;

            const itemHost = extractDomainHost(item.domain || decrypted?.url);
            if (!itemHost) continue;

            const itemRoot = getBaseRootDomain(itemHost);

            let score = 0;
            if (itemHost === currentHost) {
              score = 3;
            } else if (itemHost === currentRoot) {
              score = 2;
            } else if (itemRoot === currentRoot) {
              score = 1;
            } else {
              continue;
            }

            matches.push({
              id: item.id,
              name: item.name,
              username: decrypted.username,
              password: decrypted.password,
              score,
            });
          }

          matches.sort((a, b) => b.score - a.score);

          sendResponse({
            logins: matches.map(({ id, name, username, password }) => ({ id, name, username, password }))
          });
          break;
        }

        case "DECRYPT_ITEM": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }

          const { itemId, encryptedBlob } = message;
          const targetItem = itemId ? state.items.find((i) => i.id === itemId) : null;
          const blobToDecrypt = encryptedBlob || targetItem?.encryptedBlob;

          if (!blobToDecrypt) {
            sendResponse({ error: "Encrypted payload not found" });
            return;
          }

          if (itemId && state.decryptedItemsCache[itemId]) {
            const cached = state.decryptedItemsCache[itemId];
            sendResponse({ decrypted: cached, payload: cached });
            return;
          }

          try {
            const key = await deriveKey(state.masterPassword, state.userId || "");
            const raw = await decrypt(key, blobToDecrypt);
            const parsed = JSON.parse(raw);
            if (itemId) state.decryptedItemsCache[itemId] = parsed;
            sendResponse({ decrypted: parsed, payload: parsed });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to decrypt item" });
          }
          break;
        }

        case "SAVE_ITEM": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }

          try {
            const key = await deriveKey(state.masterPassword, state.userId || "");
            const encryptedBlob = await encrypt(key, JSON.stringify(message.payload));
            const api = await getApiClient();
            const newItem = await api.createItem({
              name: message.name,
              encryptedBlob,
              domain: message.domain || null,
              folder: message.folder || null,
              template: message.template || "login",
              tags: message.tags || [],
              favorite: false,
              hasTotp: !!message.payload?.totpSecret,
            });

            state.items.unshift(newItem);
            state.decryptedItemsCache[newItem.id] = message.payload;
            sendResponse({ success: true, item: newItem });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to save item" });
          }
          break;
        }

        case "UPDATE_ITEM": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }

          try {
            const { id, name, folder, tags, template, payload } = message;
            const key = await deriveKey(state.masterPassword, state.userId || "");
            const encryptedBlob = await encrypt(key, JSON.stringify(payload));
            const api = await getApiClient();

            const updatedItem = await api.updateItem(id, {
              name,
              encryptedBlob,
              folder: folder || null,
              tags: tags || [],
              template: template || "login",
              hasTotp: !!payload?.totpSecret,
            });

            const index = state.items.findIndex((i) => i.id === id);
            if (index !== -1) state.items[index] = updatedItem;
            state.decryptedItemsCache[id] = payload;

            sendResponse({ success: true, item: updatedItem });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to update item" });
          }
          break;
        }

        case "DELETE_ITEM": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }

          try {
            const { id } = message;
            const api = await getApiClient();
            await api.deleteItem(id);

            state.items = state.items.filter((i) => i.id !== id);
            delete state.decryptedItemsCache[id];

            sendResponse({ success: true });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to delete item" });
          }
          break;
        }

        case "GET_FOLDERS": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ folders: [] });
            return;
          }
          try {
            const api = await getApiClient();
            const res = await globalThis.fetch(`${state.serverUrl}/api/vault/folders`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              sendResponse({ folders: data.folders || [] });
            } else {
              sendResponse({ folders: [] });
            }
          } catch {
            sendResponse({ folders: [] });
          }
          break;
        }

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err: any) {
      sendResponse({ error: err?.message || "Internal Service Worker Error" });
    }
  })();

  return true;
});

console.log("[Vaultr SW] Background service worker initialized.");
