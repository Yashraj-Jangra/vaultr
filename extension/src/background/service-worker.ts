/**
 * Vaultr MV3 Extension Background Service Worker
 * Handles secure session caching, server communication, domain matching, auto-lock timers, and session restoration.
 */

import {
  VaultrApiClient,
  decrypt,
  encrypt,
  deriveKey,
  resolveDomain,
  VaultItem,
  DecryptedLoginPayload,
  isWebPageUrl,
  isInternalBrowserHost,
  createPasskeyCredential,
  signPasskeyAssertion,
  toBase64Url,
  generateTOTP,
  extractDomainHost,
  getBaseRootDomain,
  calculateDomainMatchScore,
  isIpAddress,
  extractItemCandidateUrls,
} from "@vaultr/core";

const DEFAULT_SERVER_URL = "https://vaultr.cvweb.qzz.io";

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

// Initialize server URL from local storage and restore browser override
chrome.storage.local.get(["vaultr_server_url", "autolock_minutes", "vaultr_default_manager"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
  touchAutoLock(result.autolock_minutes || "15");

  if (result.vaultr_default_manager && chrome.privacy?.services?.passwordSavingEnabled) {
    chrome.privacy.services.passwordSavingEnabled.set({ value: false }, () => {});
    if (chrome.privacy.services.autofillAddressEnabled) {
      try {
        chrome.privacy.services.autofillAddressEnabled.set({ value: false }, () => {});
      } catch {}
    }
    if (chrome.privacy.services.autofillCreditCardEnabled) {
      try {
        chrome.privacy.services.autofillCreditCardEnabled.set({ value: false }, () => {});
      } catch {}
    }
  }
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
  chrome.storage.local.remove(["autolock_expiry"]);
  chrome.alarms.clear("vaultr_autolock");
}

async function getApiClient(): Promise<VaultrApiClient> {
  const { vaultr_server_url } = await chrome.storage.local.get("vaultr_server_url");
  return new VaultrApiClient({ baseUrl: vaultr_server_url || DEFAULT_SERVER_URL });
}

// Helper to restore session from in-memory session storage if valid
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
    ]);
    const session = await chrome.storage.session.get("vaultr_master_password");

    const lockSetting = String(local.autolock_minutes ?? "15");
    const storedPw = session.vaultr_master_password;

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

    await decryptAllItems();
    await touchAutoLock(lockSetting);
    return true;
  } catch (err) {
    console.error("[Vaultr SW] Session restoration failed:", err);
    lockVault();
    return false;
  }
}

export interface MatchedLogin {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  username?: string;
  password?: string;
  totp?: string;
  hasTotp?: boolean;
  score: number;
}

async function decryptAllItems(): Promise<void> {
  if (!state.isUnlocked || !state.masterPassword || !state.items || state.items.length === 0) return;
  try {
    const key = await deriveKey(state.masterPassword, state.userId || "");
    await Promise.all(
      state.items.map(async (item) => {
        if (!item.encryptedBlob) return;
        if (state.decryptedItemsCache[item.id]) {
          item.unencryptedPayload = state.decryptedItemsCache[item.id];
          return;
        }
        try {
          const raw = await decrypt(key, item.encryptedBlob);
          const parsed = JSON.parse(raw);
          state.decryptedItemsCache[item.id] = parsed;
          item.unencryptedPayload = parsed;
        } catch {}
      })
    );
  } catch (err) {
    console.error("[Vaultr SW] decryptAllItems error:", err);
  }
}

async function getLoginsForDomain(domain?: string): Promise<MatchedLogin[]> {
  await tryRestoreSession();
  if (!state.isUnlocked || !state.masterPassword || !domain) {
    return [];
  }

  const currentHost = extractDomainHost(domain);
  if (!currentHost) {
    return [];
  }

  // Check user preference for subdomain matching (default: true)
  let allowSubdomains = true;
  try {
    const storageRes = await chrome.storage.local.get("vaultr_subdomain_matching");
    if (storageRes?.vaultr_subdomain_matching !== undefined) {
      allowSubdomains = storageRes.vaultr_subdomain_matching !== false;
    }
  } catch {}

  const key = await deriveKey(state.masterPassword, state.userId || "");
  const matches: MatchedLogin[] = [];

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

    // Collect and split all candidate URLs/domains across item and decrypted payload
    const candidateUrls = extractItemCandidateUrls(item, decrypted);
    if (candidateUrls.length === 0) continue;

    // Evaluate match score across all candidate URLs (picking highest score)
    let bestScore = 0;
    for (const cand of candidateUrls) {
      const score = calculateDomainMatchScore(cand, currentHost, allowSubdomains);
      if (score > bestScore) {
        bestScore = score;
      }
      if (bestScore === 3) break;
    }

    if (bestScore === 0) continue;

    let totpCode: string | undefined;
    if (decrypted.totpSecret) {
      try {
        totpCode = await generateTOTP(decrypted.totpSecret);
      } catch (e) {
        console.warn("[Vaultr SW] TOTP generation error:", e);
      }
    }

    matches.push({
      id: item.id,
      name: item.name,
      domain: item.domain || decrypted.url || (decrypted.urls && decrypted.urls[0]) || undefined,
      url: decrypted.url || (decrypted.urls && decrypted.urls[0]) || item.domain || undefined,
      username: decrypted.username,
      password: decrypted.password,
      totp: totpCode,
      hasTotp: !!decrypted.totpSecret,
      score: bestScore,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
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

          await decryptAllItems();

          // Save password strictly to in-memory session storage (destroyed when browser closes)
          await chrome.storage.session.set({ vaultr_master_password: masterPassword });

          const lockRes = await chrome.storage.local.get("autolock_minutes");
          const setting = String(lockRes.autolock_minutes ?? "15");
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
          if (state.items.some((i) => !i.unencryptedPayload && i.encryptedBlob)) {
            await decryptAllItems();
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
            const cleanUrl = state.serverUrl.replace(/\/+$/, "");
            const res = await globalThis.fetch(`${cleanUrl}/api/auth/me`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              const u = data.user || data;
              state.accountInfo = {
                email: u.email || "",
                name: u.displayName || u.name || "",
                image: u.avatarUrl || u.image || "",
              };
              sendResponse({ account: state.accountInfo });
            } else {
              sendResponse({ account: {} });
            }
          } catch (err) {
            console.warn("[Vaultr SW] GET_ACCOUNT_INFO error:", err);
            sendResponse({ account: {} });
          }
          break;
        }

        case "GET_LOGINS_FOR_DOMAIN": {
          const matches = await getLoginsForDomain(message.domain);
          sendResponse({
            logins: matches.map(({ id, name, domain, url, username, password, totp, hasTotp }) => ({
              id,
              name,
              domain,
              url,
              username,
              password,
              totp,
              hasTotp,
            })),
          });
          break;
        }

        case "GET_BROWSER_OVERRIDE_STATUS": {
          if (!chrome.privacy?.services?.passwordSavingEnabled) {
            sendResponse({ supported: false, isControlled: false, levelOfControl: "not_supported" });
            break;
          }
          chrome.privacy.services.passwordSavingEnabled.get({}, (details) => {
            const isControlled = details?.levelOfControl === "controlled_by_this_extension";
            sendResponse({
              supported: true,
              isControlled,
              levelOfControl: details?.levelOfControl,
              value: details?.value,
            });
          });
          break;
        }

        case "SET_BROWSER_OVERRIDE": {
          const enableOverride = !!message.enabled;
          if (!chrome.privacy?.services?.passwordSavingEnabled) {
            sendResponse({ success: false, error: "Privacy API not supported in this browser" });
            break;
          }

          if (enableOverride) {
            chrome.privacy.services.passwordSavingEnabled.set({ value: false }, async () => {
              if (chrome.privacy.services.autofillAddressEnabled) {
                try {
                  chrome.privacy.services.autofillAddressEnabled.set({ value: false }, () => {});
                } catch {}
              }
              if (chrome.privacy.services.autofillCreditCardEnabled) {
                try {
                  chrome.privacy.services.autofillCreditCardEnabled.set({ value: false }, () => {});
                } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: true });
              sendResponse({ success: true, isControlled: true });
            });
          } else {
            chrome.privacy.services.passwordSavingEnabled.clear({}, async () => {
              if (chrome.privacy.services.autofillAddressEnabled) {
                try {
                  chrome.privacy.services.autofillAddressEnabled.clear({}, () => {});
                } catch {}
              }
              if (chrome.privacy.services.autofillCreditCardEnabled) {
                try {
                  chrome.privacy.services.autofillCreditCardEnabled.clear({}, () => {});
                } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: false });
              sendResponse({ success: true, isControlled: false });
            });
          }
          break;
        }

        case "SAVE_NEW_LOGIN": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            break;
          }
          try {
            const { domain, username, password } = message;
            const key = await deriveKey(state.masterPassword, state.userId || "");
            const cleanDomain = extractDomainHost(domain) || domain;
            const name = cleanDomain || "Login";
            const payload: DecryptedLoginPayload = {
              username: username || "",
              password: password || "",
              url: domain.includes("://") ? domain : `https://${domain}`,
            };
            const encryptedBlob = await encrypt(key, JSON.stringify(payload));
            const api = await getApiClient();
            const newItem = await api.createItem({
              name,
              domain: cleanDomain,
              template: "login",
              tags: [],
              encryptedBlob,
            });
            newItem.unencryptedPayload = payload;
            state.items.unshift(newItem);
            state.decryptedItemsCache[newItem.id] = payload;
            sendResponse({ success: true, item: newItem });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to save login" });
          }
          break;
        }

        case "UPDATE_LOGIN_PASSWORD": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword) {
            sendResponse({ error: "Vault is locked" });
            break;
          }
          try {
            const { itemId, password } = message;
            const target = state.items.find((i) => i.id === itemId);
            if (!target) {
              sendResponse({ error: "Item not found" });
              break;
            }
            const key = await deriveKey(state.masterPassword, state.userId || "");
            let existingPayload: DecryptedLoginPayload = state.decryptedItemsCache[itemId];
            if (!existingPayload) {
              const raw = await decrypt(key, target.encryptedBlob);
              existingPayload = JSON.parse(raw);
            }
            const updatedPayload = { ...existingPayload, password };
            const encryptedBlob = await encrypt(key, JSON.stringify(updatedPayload));
            const api = await getApiClient();
            const updatedItem = await api.updateItem(itemId, { encryptedBlob });
            updatedItem.unencryptedPayload = updatedPayload;
            const idx = state.items.findIndex((i) => i.id === itemId);
            if (idx !== -1) state.items[idx] = updatedItem;
            state.decryptedItemsCache[itemId] = updatedPayload;
            sendResponse({ success: true, item: updatedItem });
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to update password" });
          }
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
            const itemDomain = message.domain || resolveDomain(undefined, message.name, message.payload?.url || message.payload?.urls?.[0]);

            const api = await getApiClient();
            const newItem = await api.createItem({
              name: message.name,
              encryptedBlob,
              domain: itemDomain || null,
              folder: message.folder || null,
              template: message.template || "login",
              tags: message.tags || [],
              favorite: message.favorite ?? false,
              hasTotp: !!message.payload?.totpSecret,
            });

            newItem.unencryptedPayload = message.payload;
            state.items.unshift(newItem);
            state.decryptedItemsCache[newItem.id] = message.payload;
            sendResponse({ success: true, item: newItem });
          } catch (err: any) {
            console.error("[Vaultr SW] SAVE_ITEM error:", err);
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
            const { id, name, folder, tags, template, payload, favorite } = message;
            const key = await deriveKey(state.masterPassword, state.userId || "");
            const encryptedBlob = await encrypt(key, JSON.stringify(payload));
            const itemDomain = message.domain || resolveDomain(undefined, name, payload?.url || payload?.urls?.[0]);

            const api = await getApiClient();

            const updateFields: any = {
              name,
              encryptedBlob,
              domain: itemDomain || null,
              folder: folder || null,
              tags: tags || [],
              template: template || "login",
              hasTotp: !!payload?.totpSecret,
            };
            if (favorite !== undefined) updateFields.favorite = favorite;

            const updatedItem = await api.updateItem(id, updateFields);
            updatedItem.unencryptedPayload = payload;

            const index = state.items.findIndex((i) => i.id === id);
            if (index !== -1) state.items[index] = updatedItem;
            state.decryptedItemsCache[id] = payload;

            sendResponse({ success: true, item: updatedItem });
          } catch (err: any) {
            console.error("[Vaultr SW] UPDATE_ITEM error:", err);
            sendResponse({ error: err?.message || "Failed to update item" });
          }
          break;
        }

        case "TOGGLE_FAVORITE": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            return;
          }
          try {
            const { id } = message;
            const api = await getApiClient();
            const target = state.items.find((i) => i.id === id);
            if (target) {
              const updatedItem = await api.updateItem(id, { favorite: !target.favorite });
              const index = state.items.findIndex((i) => i.id === id);
              if (index !== -1) state.items[index] = updatedItem;
              sendResponse({ success: true, item: updatedItem });
            } else {
              sendResponse({ error: "Item not found" });
            }
          } catch (err: any) {
            console.error("[Vaultr SW] TOGGLE_FAVORITE error:", err);
            sendResponse({ error: err?.message || "Failed to toggle favorite" });
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

function normalizeCredentialId(id: string | undefined | null): string {
  if (!id) return "";
  return id.trim().replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
}

        case "CHECK_PASSKEY_AVAILABLE": {
          await tryRestoreSession();
          const { vaultr_passkeys_enabled } = await chrome.storage.local.get("vaultr_passkeys_enabled");
          sendResponse({
            isUnlocked: state.isUnlocked,
            enabled: vaultr_passkeys_enabled !== false,
          });
          break;
        }

        case "GET_PASSKEYS_FOR_RP": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword || !state.userId) {
            sendResponse({ passkeys: [] });
            return;
          }

          const rpId = (message.rpId || "").toLowerCase();
          const allowCredentials = message.allowCredentials || [];
          const key = await deriveKey(state.masterPassword, state.userId);
          const matched: Array<{ id: string; name: string; username?: string; credentialId?: string }> = [];

          for (const item of state.items) {
            if (item.deletedAt) continue;
            const tmpl = item.template || "login";
            if (tmpl !== "login") continue;

            let p = state.decryptedItemsCache[item.id];
            if (!p) {
              try {
                const raw = await decrypt(key, item.encryptedBlob);
                p = JSON.parse(raw);
                state.decryptedItemsCache[item.id] = p;
              } catch {
                continue;
              }
            }

            if (!p.passkeyPrivateKey) continue;

            const itemRp = (p.passkeyRpId || item.domain || "").toLowerCase();
            const rpMatches = !rpId || itemRp === rpId || itemRp.includes(rpId) || rpId.includes(itemRp);
            if (!rpMatches) continue;

            if (allowCredentials.length > 0) {
              const allowed = allowCredentials.some(
                (c: any) => normalizeCredentialId(c.id) === normalizeCredentialId(p.passkeyCredentialId)
              );
              if (!allowed) continue;
            }

            matched.push({
              id: item.id,
              name: item.name,
              username: p.username,
              credentialId: p.passkeyCredentialId,
            });
          }

          // Fallback: If allowCredentials was specified but filtered out all candidates,
          // include passkeys for this RP anyway so discoverable/resident credentials work
          if (matched.length === 0 && allowCredentials.length > 0) {
            for (const item of state.items) {
              if (item.deletedAt) continue;
              const tmpl = item.template || "login";
              if (tmpl !== "login") continue;

              const p = state.decryptedItemsCache[item.id];
              if (!p || !p.passkeyPrivateKey) continue;

              const itemRp = (p.passkeyRpId || item.domain || "").toLowerCase();
              const rpMatches = !rpId || itemRp === rpId || itemRp.includes(rpId) || rpId.includes(itemRp);
              if (!rpMatches) continue;

              matched.push({
                id: item.id,
                name: item.name,
                username: p.username,
                credentialId: p.passkeyCredentialId,
              });
            }
          }

          sendResponse({ passkeys: matched });
          break;
        }

        case "WEBAUTHN_CREATE": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword || !state.userId) {
            sendResponse({ error: "Vault is locked. Unlock VaultR to save passkeys.", handled: false });
            return;
          }

          const { payload } = message;
          const origin = payload.origin || "";
          let rpId = payload.rp?.id || "";
          if (!rpId && origin) {
            try {
              rpId = new URL(origin).hostname;
            } catch {
              rpId = "localhost";
            }
          }

          try {
            const credResult = await createPasskeyCredential({
              rpId,
              rpName: payload.rp?.name,
              userName: payload.user?.name,
              userDisplayName: payload.user?.displayName,
              userHandle: payload.user?.id,
              challenge: payload.challenge,
              origin,
            });

            const key = await deriveKey(state.masterPassword, state.userId);
            const api = await getApiClient();

            // Look for existing login item matching this domain/RP
            const cleanRp = rpId.toLowerCase();
            const existingItem = state.items.find((item) => {
              if (item.deletedAt) return false;
              const tmpl = item.template || "login";
              if (tmpl !== "login") return false;
              const d = (item.domain || "").toLowerCase();
              const n = (item.name || "").toLowerCase();
              return d === cleanRp || d.includes(cleanRp) || cleanRp.includes(d) || n === cleanRp || n.includes(cleanRp);
            });

            if (existingItem) {
              let existingPayload: any = state.decryptedItemsCache[existingItem.id];
              if (!existingPayload) {
                try {
                  const raw = await decrypt(key, existingItem.encryptedBlob);
                  existingPayload = JSON.parse(raw);
                } catch {
                  existingPayload = {};
                }
              }

              const updatedPayload: DecryptedLoginPayload = {
                ...existingPayload,
                isPasskey: true,
                passkeyRpId: rpId,
                passkeyCredentialId: credResult.credentialId,
                passkeyUserHandle: credResult.passkeyUserHandle,
                passkeyPrivateKey: credResult.passkeyPrivateKey,
                passkeySignCount: 0,
                passkeyTransports: ["internal", "hybrid"],
                passkeyCreatedAt: new Date().toISOString(),
                passkeyLastUsedAt: new Date().toISOString(),
              };

              const tags = Array.from(new Set([...(existingItem.tags || []), "passkey"]));
              const encryptedBlob = await encrypt(key, JSON.stringify(updatedPayload));

              const updatedItem = await api.updateItem(existingItem.id, {
                encryptedBlob,
                tags,
                template: "login",
              });

              const idx = state.items.findIndex((i) => i.id === existingItem.id);
              if (idx !== -1) state.items[idx] = updatedItem;
              state.decryptedItemsCache[existingItem.id] = updatedPayload;

              sendResponse({
                handled: true,
                success: true,
                credential: {
                  id: credResult.credentialId,
                  credentialId: credResult.credentialId,
                  clientDataJSON: credResult.clientDataJSON,
                  attestationObject: toBase64Url(credResult.attestationObject),
                  authenticatorData: toBase64Url(credResult.authenticatorData),
                  publicKey: toBase64Url(credResult.publicKeySpki),
                },
              });
            } else {
              const newPayload: DecryptedLoginPayload = {
                username: payload.user?.name || payload.user?.displayName || "",
                password: "",
                url: origin,
                isPasskey: true,
                passkeyRpId: rpId,
                passkeyCredentialId: credResult.credentialId,
                passkeyUserHandle: credResult.passkeyUserHandle,
                passkeyPrivateKey: credResult.passkeyPrivateKey,
                passkeySignCount: 0,
                passkeyTransports: ["internal", "hybrid"],
                passkeyCreatedAt: new Date().toISOString(),
                passkeyLastUsedAt: new Date().toISOString(),
              };

              const encryptedBlob = await encrypt(key, JSON.stringify(newPayload));
              const newItem = await api.createItem({
                name: payload.rp?.name || rpId,
                domain: rpId,
                template: "login",
                tags: ["passkey"],
                encryptedBlob,
              });

              state.items.unshift(newItem);
              state.decryptedItemsCache[newItem.id] = newPayload;

              sendResponse({
                handled: true,
                success: true,
                credential: {
                  id: credResult.credentialId,
                  credentialId: credResult.credentialId,
                  clientDataJSON: credResult.clientDataJSON,
                  attestationObject: toBase64Url(credResult.attestationObject),
                  authenticatorData: toBase64Url(credResult.authenticatorData),
                  publicKey: toBase64Url(credResult.publicKeySpki),
                },
              });
            }
          } catch (err: any) {
            console.error("[Vaultr SW] WEBAUTHN_CREATE failed:", err);
            sendResponse({ handled: false, error: err?.message || "Failed to create passkey" });
          }
          break;
        }

        case "WEBAUTHN_GET": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword || !state.userId) {
            sendResponse({ handled: false, error: "Vault is locked." });
            return;
          }

          const { payload } = message;
          const rpId = payload.rpId || "";
          const allowCredentials = payload.allowCredentials || [];
          const selectedItemId = payload.selectedItemId;
          const cleanRp = rpId.toLowerCase();

          try {
            const key = await deriveKey(state.masterPassword, state.userId);
            let matchedItem: VaultItem | null = null;
            let matchedPayload: DecryptedLoginPayload | null = null;

            // 1. If user explicitly confirmed a passkey item from the in-page prompt, prioritize it directly
            if (selectedItemId) {
              const item = state.items.find((i) => i.id === selectedItemId && !i.deletedAt);
              if (item) {
                let p = state.decryptedItemsCache[item.id];
                if (!p) {
                  try {
                    const raw = await decrypt(key, item.encryptedBlob);
                    p = JSON.parse(raw);
                    state.decryptedItemsCache[item.id] = p;
                  } catch {}
                }
                if (p && (p.isPasskey || p.passkeyPrivateKey)) {
                  matchedItem = item;
                  matchedPayload = p;
                }
              }
            }

            // 2. Otherwise scan items matching RP and allowCredentials
            if (!matchedItem) {
              for (const item of state.items) {
                if (item.deletedAt) continue;
                const tmpl = item.template || "login";
                if (tmpl !== "login") continue;

                let p = state.decryptedItemsCache[item.id];
                if (!p) {
                  try {
                    const raw = await decrypt(key, item.encryptedBlob);
                    p = JSON.parse(raw);
                    state.decryptedItemsCache[item.id] = p;
                  } catch {
                    continue;
                  }
                }

                if (!p.isPasskey && !p.passkeyPrivateKey) continue;

                const itemRp = (p.passkeyRpId || item.domain || "").toLowerCase();
                const rpMatches = !cleanRp || itemRp === cleanRp || itemRp.includes(cleanRp) || cleanRp.includes(itemRp);
                if (!rpMatches) continue;

                if (allowCredentials.length > 0) {
                  const allowed = allowCredentials.some(
                    (c: any) => normalizeCredentialId(c.id) === normalizeCredentialId(p.passkeyCredentialId)
                  );
                  if (!allowed) continue;
                }

                matchedItem = item;
                matchedPayload = p;
                break;
              }
            }

            // 3. Fallback: If allowCredentials didn't match any but we have candidates for this RP
            if (!matchedItem && allowCredentials.length > 0) {
              for (const item of state.items) {
                if (item.deletedAt) continue;
                const tmpl = item.template || "login";
                if (tmpl !== "login") continue;

                let p = state.decryptedItemsCache[item.id];
                if (!p) {
                  try {
                    const raw = await decrypt(key, item.encryptedBlob);
                    p = JSON.parse(raw);
                    state.decryptedItemsCache[item.id] = p;
                  } catch {
                    continue;
                  }
                }

                if (!p.isPasskey && !p.passkeyPrivateKey) continue;

                const itemRp = (p.passkeyRpId || item.domain || "").toLowerCase();
                const rpMatches = !cleanRp || itemRp === cleanRp || itemRp.includes(cleanRp) || cleanRp.includes(itemRp);
                if (!rpMatches) continue;

                matchedItem = item;
                matchedPayload = p;
                break;
              }
            }

            if (!matchedItem || !matchedPayload || !matchedPayload.passkeyPrivateKey) {
              sendResponse({ handled: false, error: "No matching passkey found" });
              return;
            }

            const currentCount = matchedPayload.passkeySignCount || 0;
            const signCount = currentCount + 1;
            const effectiveRp = payload.rpId || matchedPayload.passkeyRpId || rpId;

            const assertionResult = await signPasskeyAssertion({
              passkeyPrivateKey: matchedPayload.passkeyPrivateKey,
              rpId: effectiveRp,
              challenge: payload.challenge,
              origin: payload.origin,
              signCount,
            });

            matchedPayload.passkeySignCount = signCount;
            matchedPayload.passkeyLastUsedAt = new Date().toISOString();
            state.decryptedItemsCache[matchedItem.id] = matchedPayload;

            const encryptedBlob = await encrypt(key, JSON.stringify(matchedPayload));
            const api = await getApiClient();
            api.updateItem(matchedItem.id, { encryptedBlob }).catch(() => {});

            sendResponse({
              handled: true,
              success: true,
              credential: {
                id: matchedPayload.passkeyCredentialId,
                credentialId: matchedPayload.passkeyCredentialId,
                authenticatorData: toBase64Url(assertionResult.authenticatorData),
                clientDataJSON: assertionResult.clientDataJSON,
                signature: toBase64Url(assertionResult.signature),
                userHandle: matchedPayload.passkeyUserHandle || null,
              },
            });
          } catch (err: any) {
            console.error("[Vaultr SW] WEBAUTHN_GET failed:", err);
            let userMsg = "Passkey assertion failed";
            if (err?.message?.includes("keyData") || err?.name === "DataError") {
              userMsg = "Passkey private key is invalid (or contains only public key metadata from an export). Please re-enroll this passkey in your Google Account settings.";
            } else if (err?.message) {
              userMsg = err.message;
            }
            sendResponse({ handled: false, error: userMsg });
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

// ─── Context Menus & Keyboard Shortcuts ────────────────────────────────────────

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "vaultr_root",
      title: "VaultR",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      parentId: "vaultr_root",
      id: "vaultr_autofill",
      title: "Autofill Credentials (Ctrl+Shift+L)",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      parentId: "vaultr_root",
      id: "vaultr_copy_totp",
      title: "Copy 2FA Code (Ctrl+Shift+T)",
      contexts: ["editable", "page"],
    });
    chrome.contextMenus.create({
      parentId: "vaultr_root",
      id: "vaultr_generate_password",
      title: "Generate Secure Password",
      contexts: ["editable"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.runtime.onStartup?.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url) return;
  if (info.menuItemId === "vaultr_autofill") {
    const matches = await getLoginsForDomain(tab.url);
    if (matches.length > 0) {
      chrome.tabs.sendMessage(tab.id, {
        type: "TRIGGER_AUTOFILL",
        credential: matches[0],
      });
    }
  } else if (info.menuItemId === "vaultr_copy_totp") {
    const matches = await getLoginsForDomain(tab.url);
    const withTotp = matches.find((m) => m.totp);
    if (withTotp?.totp) {
      chrome.tabs.sendMessage(tab.id, {
        type: "COPY_TOTP_CLIPBOARD",
        totp: withTotp.totp,
        accountName: withTotp.name,
      });
    }
  } else if (info.menuItemId === "vaultr_generate_password") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    const pwd = Array.from(array, (byte) => chars[byte % chars.length]).join("");
    chrome.tabs.sendMessage(tab.id, {
      type: "FILL_GENERATED_PASSWORD",
      password: pwd,
    });
  }
});

chrome.commands?.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !activeTab.url) return;

  if (command === "autofill_credential") {
    const matches = await getLoginsForDomain(activeTab.url);
    if (matches.length > 0) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: "TRIGGER_AUTOFILL",
        credential: matches[0],
      });
    }
  } else if (command === "copy_totp") {
    const matches = await getLoginsForDomain(activeTab.url);
    const withTotp = matches.find((m) => m.totp);
    if (withTotp?.totp) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: "COPY_TOTP_CLIPBOARD",
        totp: withTotp.totp,
        accountName: withTotp.name,
      });
    }
  }
});

