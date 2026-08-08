/**
 * Vaultr MV3 Extension Background Service Worker
 * Handles secure session caching, server communication, domain matching, and auto-lock alarms.
 */

import { VaultrApiClient, decrypt, deriveKey, VaultItem, DecryptedLoginPayload } from "@vaultr/core";

const DEFAULT_SERVER_URL = "http://localhost:3000";

interface ServiceWorkerState {
  serverUrl: string;
  masterPassword: string | null;
  items: VaultItem[];
  decryptedItemsCache: Record<string, DecryptedLoginPayload>;
  isUnlocked: boolean;
}

const state: ServiceWorkerState = {
  serverUrl: DEFAULT_SERVER_URL,
  masterPassword: null,
  items: [],
  decryptedItemsCache: {},
  isUnlocked: false,
};

// Initialize server URL from local storage or default
chrome.storage.local.get(["vaultr_server_url"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
});

// Alarm handler for auto-lock
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "vaultr_autolock") {
    lockVault();
  }
});

function lockVault() {
  state.masterPassword = null;
  state.items = [];
  state.decryptedItemsCache = {};
  state.isUnlocked = false;
  chrome.storage.session.remove(["vaultr_master_password"]);
  chrome.alarms.clear("vaultr_autolock");
  console.log("[Vaultr Service Worker] Vault locked.");
}

async function getApiClient(): Promise<VaultrApiClient> {
  const { vaultr_server_url } = await chrome.storage.local.get("vaultr_server_url");
  const serverUrl = vaultr_server_url || DEFAULT_SERVER_URL;
  return new VaultrApiClient({
    baseUrl: serverUrl,
  });
}

// Message Listener for Popup and Content Script
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
          const { masterPassword, salt = "vaultr_default_salt" } = message;
          const api = await getApiClient();
          const items = await api.getItems();

          // Verify unlock by attempting to derive key
          const key = await deriveKey(masterPassword, salt);
          
          state.masterPassword = masterPassword;
          state.items = items;
          state.isUnlocked = true;

          // Cache master password in session storage (cleared when browser closes)
          await chrome.storage.session.set({ vaultr_master_password: masterPassword });

          // Set auto-lock alarm (15 minutes default)
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

        case "GET_LOGINS_FOR_DOMAIN": {
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ logins: [] });
            return;
          }

          const targetDomain = (message.domain || "").toLowerCase().replace(/^www\./, "");
          const key = await deriveKey(state.masterPassword, "vaultr_default_salt");

          const matchingLogins: Array<{ id: string; name: string; username?: string; password?: string }> = [];

          for (const item of state.items) {
            if (item.template !== "login" && item.template !== undefined) continue;

            const itemDomain = (item.domain || "").toLowerCase().replace(/^www\./, "");
            const nameMatches = item.name.toLowerCase().includes(targetDomain);

            if (itemDomain.includes(targetDomain) || targetDomain.includes(itemDomain) || nameMatches) {
              try {
                let decryptedPayload = state.decryptedItemsCache[item.id];
                if (!decryptedPayload) {
                  const rawJson = await decrypt(key, item.encryptedBlob);
                  decryptedPayload = JSON.parse(rawJson) as DecryptedLoginPayload;
                  state.decryptedItemsCache[item.id] = decryptedPayload;
                }

                matchingLogins.push({
                  id: item.id,
                  name: item.name,
                  username: decryptedPayload.username,
                  password: decryptedPayload.password,
                });
              } catch (err) {
                console.error("[Vaultr SW] Failed to decrypt item:", item.id, err);
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
          const key = await deriveKey(state.masterPassword, "vaultr_default_salt");
          const raw = await decrypt(key, encryptedBlob);
          sendResponse({ payload: JSON.parse(raw) });
          break;
        }

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err: any) {
      console.error("[Vaultr SW Error]", err);
      sendResponse({ error: err?.message || "Internal Service Worker Error" });
    }
  })();

  return true; // Keep message channel open for async response
});
