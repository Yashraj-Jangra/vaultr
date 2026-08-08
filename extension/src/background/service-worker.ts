/**
 * Vaultr MV3 Extension Background Service Worker
 * Handles secure session caching, server communication, domain matching, and auto-lock alarms.
 */

import { VaultrApiClient, decrypt, deriveKey, VaultItem, DecryptedLoginPayload } from "@vaultr/core";

const DEFAULT_SERVER_URL = "http://localhost:3000";
const DEFAULT_SALT = "vaultr_default_salt";

interface ServiceWorkerState {
  serverUrl: string;
  masterPassword: string | null;
  items: VaultItem[];
  decryptedItemsCache: Record<string, DecryptedLoginPayload>;
  isUnlocked: boolean;
  accountInfo: { email?: string; name?: string } | null;
}

const state: ServiceWorkerState = {
  serverUrl: DEFAULT_SERVER_URL,
  masterPassword: null,
  items: [],
  decryptedItemsCache: {},
  isUnlocked: false,
  accountInfo: null,
};

// Initialize server URL from local storage
chrome.storage.local.get(["vaultr_server_url"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
});

// Auto-lock alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "vaultr_autolock") lockVault();
});

function lockVault() {
  state.masterPassword = null;
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

        case "UNLOCK": {
          const { masterPassword } = message;
          const api = await getApiClient();

          // Fetch items from server (validates session cookie)
          const items = await api.getItems();

          // Derive encryption key (validates master password locally)
          await deriveKey(masterPassword, DEFAULT_SALT);

          state.masterPassword = masterPassword;
          state.items = items;
          state.isUnlocked = true;

          // Persist master password in session storage (clears when browser closes)
          await chrome.storage.session.set({ vaultr_master_password: masterPassword });

          // Fetch account info while we're at it
          try {
            const accountRes = await globalThis.fetch(`${state.serverUrl}/api/me`, {
              credentials: "include",
            });
            if (accountRes.ok) {
              const data = await accountRes.json();
              state.accountInfo = { email: data.email, name: data.name };
            }
          } catch {
            // Non-fatal — account info is optional
          }

          // Reset auto-lock alarm
          chrome.alarms.clear("vaultr_autolock");
          chrome.alarms.create("vaultr_autolock", { delayInMinutes: 15 });

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
          // If we already have it, return it
          if (state.accountInfo) {
            sendResponse({ account: state.accountInfo });
            return;
          }
          // Otherwise try to fetch
          try {
            const res = await globalThis.fetch(`${state.serverUrl}/api/me`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              state.accountInfo = { email: data.email, name: data.name };
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
          const key = await deriveKey(state.masterPassword, DEFAULT_SALT);
          const matchingLogins: Array<{ id: string; name: string; username?: string; password?: string }> = [];

          for (const item of state.items) {
            // Only match login-type items
            if (item.template && item.template !== "login") continue;

            const itemDomain = (item.domain || "").toLowerCase().replace(/^www\./, "");
            const nameMatch = item.name.toLowerCase().includes(targetDomain);

            if (!targetDomain || itemDomain.includes(targetDomain) || targetDomain.includes(itemDomain) || nameMatch) {
              if (!targetDomain) continue; // don't show everything if no domain
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
          const { encryptedBlob } = message;
          const key = await deriveKey(state.masterPassword, DEFAULT_SALT);
          const raw = await decrypt(key, encryptedBlob);
          sendResponse({ payload: JSON.parse(raw) });
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

  return true; // Keep message channel open for async response
});
