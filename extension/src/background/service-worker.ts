/**
 * Vaultr MV3 Extension Background Service Worker
 * Handles secure session caching, server communication, domain matching, and auto-lock alarms.
 */

import { VaultrApiClient, decrypt, encrypt, deriveKey, VaultItem, DecryptedLoginPayload } from "@vaultr/core";

const DEFAULT_SERVER_URL = "http://localhost:3000";
const DEFAULT_SALT = "vaultr_default_salt";

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

// Initialize server URL and auto-lock preferences from local storage
chrome.storage.local.get(["vaultr_server_url", "autolock_minutes"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
  const minutes = Number(result.autolock_minutes || "15");
  setupAutoLock(minutes);
});

// Auto-lock alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "vaultr_autolock") lockVault();
});

function setupAutoLock(minutes: number) {
  chrome.alarms.clear("vaultr_autolock");
  if (minutes > 0) {
    chrome.alarms.create("vaultr_autolock", { delayInMinutes: minutes });
    console.log(`[Vaultr SW] Auto-lock scheduled in ${minutes} minutes.`);
  } else {
    console.log("[Vaultr SW] Auto-lock disabled.");
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
  chrome.alarms.clear("vaultr_autolock");
  console.log("[Vaultr SW] Vault locked.");
}

async function getApiClient(): Promise<VaultrApiClient> {
  const { vaultr_server_url } = await chrome.storage.local.get("vaultr_server_url");
  return new VaultrApiClient({ baseUrl: vaultr_server_url || DEFAULT_SERVER_URL });
}

// Helper to refresh items in background
async function refreshItems(api: VaultrApiClient) {
  try {
    state.items = await api.getItems();
  } catch (err) {
    console.error("[Vaultr SW] Refresh items failed:", err);
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {

        case "GET_STATUS": {
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
          setupAutoLock(message.minutes);
          sendResponse({ success: true });
          break;
        }

        case "UNLOCK": {
          const { masterPassword } = message;
          const api = await getApiClient();

          // Fetch items from server (validates session cookie)
          const items = await api.getItems();

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
            throw new Error("Failed to retrieve user identity for decryption.");
          }

          // Derive encryption key using user.id as salt (matching site exactly)
          const key = await deriveKey(masterPassword, userId);

          // Validate master password correctness against vault items
          if (items.length > 0) {
            let verified = false;
            for (const item of items) {
              if (!item.encryptedBlob) continue;
              try {
                const raw = await decrypt(key, item.encryptedBlob);
                if (raw) {
                  verified = true;
                  try {
                    state.decryptedItemsCache[item.id] = JSON.parse(raw);
                  } catch {}
                  break;
                }
              } catch {
                // AES-GCM decryption failed for this item (wrong password)
              }
            }
            if (!verified) {
              throw new Error("Incorrect master password");
            }
          }

          state.masterPassword = masterPassword;
          state.userId = userId;
          state.items = items;
          state.isUnlocked = true;

          // Persist master password in session storage (clears when browser closes)
          await chrome.storage.session.set({ vaultr_master_password: masterPassword });

          // Reset auto-lock alarm based on user preference
          const res = await chrome.storage.local.get("autolock_minutes");
          const minutes = Number(res.autolock_minutes || "15");
          setupAutoLock(minutes);

          sendResponse({ success: true, count: items.length });
          break;
        }

        case "LOCK": {
          lockVault();
          sendResponse({ success: true });
          break;
        }

        case "GET_ITEMS": {
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          sendResponse({ items: state.items });
          break;
        }

        case "GET_ACCOUNT_INFO": {
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

        case "GET_LOGINS_FOR_DOMAIN": {
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ logins: [] });
            return;
          }

          const targetDomain = (message.domain || "").toLowerCase().replace(/^www\./, "");
          const key = await deriveKey(state.masterPassword, state.userId || "");
          const matchingLogins: Array<{ id: string; name: string; username?: string; password?: string }> = [];

          for (const item of state.items) {
            if (item.deletedAt) continue; // skip items in trash
            if (item.template && item.template !== "login") continue;

            const itemDomain = (item.domain || "").toLowerCase().replace(/^www\./, "");
            const nameMatch = item.name.toLowerCase().includes(targetDomain);

            if (!targetDomain || itemDomain.includes(targetDomain) || targetDomain.includes(itemDomain) || nameMatch) {
              if (!targetDomain) continue;
              try {
                let decrypted = state.decryptedItemsCache[item.id];
                if (!decrypted) {
                  const raw = await decrypt(key, item.encryptedBlob);
                  decrypted = JSON.parse(raw) as DecryptedLoginPayload;
                  state.decryptedItemsCache[item.id] = decrypted;
                }
                matchingLogins.push({
                  id: item.id,
                  name: item.name,
                  username: decrypted.username,
                  password: decrypted.password,
                });
              } catch (err) {
                console.error("[Vaultr SW] Decrypt error:", item.id, err);
              }
            }
          }

          sendResponse({ logins: matchingLogins });
          break;
        }

        case "DECRYPT_ITEM": {
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          const { encryptedBlob, itemId } = message;
          if (itemId && state.decryptedItemsCache[itemId]) {
            sendResponse({ payload: state.decryptedItemsCache[itemId] });
            return;
          }
          const key = await deriveKey(state.masterPassword, state.userId || "");
          const raw = await decrypt(key, encryptedBlob);
          const parsed = JSON.parse(raw);
          if (itemId) {
            state.decryptedItemsCache[itemId] = parsed;
          }
          sendResponse({ payload: parsed });
          break;
        }

        case "SAVE_ITEM": {
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          const { name, template, folder, tags, payload } = message;
          const api = await getApiClient();
          const key = await deriveKey(state.masterPassword, state.userId || "");
          const encryptedBlob = await encrypt(key, JSON.stringify(payload));
          const domain = payload.url ? new URL(payload.url.startsWith("http") ? payload.url : `https://${payload.url}`).hostname : "";

          const newItem = await api.createItem({
            name,
            template,
            folder: folder || undefined,
            tags,
            encryptedBlob,
            domain: domain || undefined,
            favorite: false,
            hasTotp: !!payload.totpSecret,
          });

          state.decryptedItemsCache[newItem.id] = payload;
          await refreshItems(api);
          sendResponse({ success: true, item: newItem });
          break;
        }

        case "UPDATE_ITEM": {
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          const { id, name, template, folder, tags, payload } = message;
          const api = await getApiClient();
          const key = await deriveKey(state.masterPassword, state.userId || "");
          const encryptedBlob = await encrypt(key, JSON.stringify(payload));
          const domain = payload.url ? new URL(payload.url.startsWith("http") ? payload.url : `https://${payload.url}`).hostname : "";

          const updated = await api.updateItem(id, {
            name,
            template,
            folder: folder || undefined,
            tags,
            encryptedBlob,
            domain: domain || undefined,
            hasTotp: !!payload.totpSecret,
          });

          state.decryptedItemsCache[id] = payload;
          await refreshItems(api);
          sendResponse({ success: true, item: updated });
          break;
        }

        case "DELETE_ITEM": {
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          const { id } = message;
          const api = await getApiClient();
          
          // Soft delete (move to Trash by setting deletedAt)
          await api.updateItem(id, {
            deletedAt: new Date().toISOString(),
          });

          delete state.decryptedItemsCache[id];
          await refreshItems(api);
          sendResponse({ success: true });
          break;
        }

        case "GET_FOLDERS": {
          if (!state.isUnlocked) {
            sendResponse({ folders: [] });
            return;
          }
          const folders = Array.from(
            new Set(
              state.items
                .map((i) => i.folder)
                .filter((f): f is string => !!f && f.trim() !== "")
            )
          ).sort();
          sendResponse({ folders });
          break;
        }

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err: any) {
      console.error("[Vaultr SW Error]", err);
      sendResponse({ error: err?.message || "Internal error" });
    }
  })();

  return true;
});
