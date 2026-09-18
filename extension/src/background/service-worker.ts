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

function isMicrosoftEdge(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Edg\//i.test(navigator.userAgent)) return true;
  const brands = (navigator as any).userAgentData?.brands;
  if (Array.isArray(brands)) {
    return brands.some((b: any) => /Edge/i.test(b.brand));
  }
  return false;
}

// Initialize server URL from local storage and restore browser override
chrome.storage.local.get(["vaultr_server_url", "autolock_minutes", "vaultr_default_manager"], (result) => {
  if (result.vaultr_server_url) {
    state.serverUrl = result.vaultr_server_url;
  }
  touchAutoLock(result.autolock_minutes || "15");

  if (isMicrosoftEdge()) {
    // In Microsoft Edge, disabling passwordSavingEnabled shuts down Microsoft Wallet / Passkey manager,
    // which breaks Windows Hello and causes Edge to block WebAuthn with "To create a passkey, turn on Microsoft Password Manager".
    // We clear passwordSavingEnabled so Windows Hello passkeys are never blocked.
    if (chrome.privacy?.services?.passwordSavingEnabled) {
      try {
        chrome.privacy.services.passwordSavingEnabled.clear({}, () => {});
      } catch {}
    }
  }

  if (result.vaultr_default_manager) {
    if (!isMicrosoftEdge() && chrome.privacy?.services?.passwordSavingEnabled) {
      try {
        chrome.privacy.services.passwordSavingEnabled.set({ value: false }, () => {});
      } catch {}
    }
    if (chrome.privacy?.services?.autofillAddressEnabled) {
      try {
        chrome.privacy.services.autofillAddressEnabled.set({ value: false }, () => {});
      } catch {}
    }
    if (chrome.privacy?.services?.autofillCreditCardEnabled) {
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
  clearAllBadges();
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
    let isSessionExplicitlyRevoked = false;

    const cleanUrl = state.serverUrl.replace(/\/+$/, "");
    try {
      const meRes = await globalThis.fetch(`${cleanUrl}/api/me`, { credentials: "include" });
      if (meRes.ok) {
        const data = await meRes.json();
        state.accountInfo = { email: data.email, name: data.name, image: data.image };
        userId = data.id;
      } else if (meRes.status === 401 || meRes.status === 403) {
        isSessionExplicitlyRevoked = true;
      }
    } catch {
      // Network failure, offline, or transient error - do not treat as explicit session revocation
    }

    if (!userId) {
      lockVault();
      // Only wipe persistent PIN credentials if the server explicitly confirmed the session was revoked
      if (isSessionExplicitlyRevoked && typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove([
          "vaultr_pin_blob",
          "vaultr_pin_enabled",
          "vaultr_pin_failed_attempts",
        ]).catch(() => {});
      }
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
    updateAllTabBadges();
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
  matchedDomain?: string;
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
    let bestMatchedDomain = "";
    for (const cand of candidateUrls) {
      const score = calculateDomainMatchScore(cand, currentHost, allowSubdomains);
      if (score > bestScore) {
        bestScore = score;
        bestMatchedDomain = extractDomainHost(cand) || cand;
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
      matchedDomain: bestMatchedDomain,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

// ─── Autofill Suggestions Count Badge ─────────────────────────────────────────

async function isBadgeCountEnabled(): Promise<boolean> {
  try {
    const res = await chrome.storage.local.get("vaultr_show_badge_count");
    if (res?.vaultr_show_badge_count !== undefined) {
      return res.vaultr_show_badge_count !== false;
    }
    return true;
  } catch {
    return true;
  }
}

async function getMatchingLoginsCount(url: string): Promise<number> {
  if (!state.isUnlocked || !url || !isWebPageUrl(url)) return 0;
  const currentHost = extractDomainHost(url);
  if (!currentHost || isInternalBrowserHost(currentHost)) return 0;

  let allowSubdomains = true;
  try {
    const storageRes = await chrome.storage.local.get("vaultr_subdomain_matching");
    if (storageRes?.vaultr_subdomain_matching !== undefined) {
      allowSubdomains = storageRes.vaultr_subdomain_matching !== false;
    }
  } catch {}

  let key: any = null;
  let matchCount = 0;

  for (const item of state.items) {
    if (item.deletedAt) continue;
    const template = item.template || "login";
    if (template !== "login") continue;

    let decrypted = state.decryptedItemsCache[item.id];
    if (!decrypted) {
      if (!state.masterPassword) continue;
      if (!key) {
        key = await deriveKey(state.masterPassword, state.userId || "");
      }
      try {
        const raw = await decrypt(key, item.encryptedBlob);
        decrypted = JSON.parse(raw) as DecryptedLoginPayload;
        state.decryptedItemsCache[item.id] = decrypted;
      } catch {
        continue;
      }
    }

    if (!decrypted.username && !decrypted.password) continue;

    const candidateUrls = extractItemCandidateUrls(item, decrypted);
    if (candidateUrls.length === 0) continue;

    for (const cand of candidateUrls) {
      const score = calculateDomainMatchScore(cand, currentHost, allowSubdomains);
      if (score > 0) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount;
}

async function updateTabBadge(tabId: number, url?: string) {
  if (!tabId || tabId < 0) return;
  try {
    const enabled = await isBadgeCountEnabled();
    if (!enabled || !state.isUnlocked || !url || !isWebPageUrl(url)) {
      chrome.action.setBadgeText({ tabId, text: "" });
      return;
    }

    const count = await getMatchingLoginsCount(url);
    const badgeText = count > 0 ? (count > 99 ? "99+" : String(count)) : "";

    chrome.action.setBadgeText({ tabId, text: badgeText });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
  } catch {
    // Ignore errors for closed or privileged tabs
  }
}

async function updateAllTabBadges() {
  try {
    const enabled = await isBadgeCountEnabled();
    if (!enabled || !state.isUnlocked) {
      clearAllBadges();
      return;
    }

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        updateTabBadge(tab.id, tab.url);
      }
    }
  } catch (err) {
    console.warn("[Vaultr SW] updateAllTabBadges error:", err);
  }
}

function clearAllBadges() {
  try {
    chrome.action.setBadgeText({ text: "" });
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError || !tabs) return;
      for (const tab of tabs) {
        if (tab.id) {
          try {
            chrome.action.setBadgeText({ tabId: tab.id, text: "" });
          } catch {}
        }
      }
    });
  } catch {}
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
          updateAllTabBadges();

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

        case "CHANGE_MASTER_PASSWORD": {
          await tryRestoreSession();
          if (!state.isUnlocked || !state.masterPassword || !state.userId) {
            sendResponse({ error: "Vault is locked. Unlock first." });
            break;
          }

          const { oldPassword, newPassword } = message;

          if (!oldPassword || !newPassword) {
            sendResponse({ error: "Please provide both current and new master passwords." });
            break;
          }
          if (newPassword.length < 8) {
            sendResponse({ error: "New master password must be at least 8 characters." });
            break;
          }
          if (oldPassword === newPassword) {
            sendResponse({ error: "New master password must differ from current master password." });
            break;
          }

          try {
            // 1. Derive old key and verify it against vault items
            const oldKey = await deriveKey(oldPassword, state.userId);
            const itemsWithBlob = state.items.filter((i) => i.encryptedBlob);
            if (itemsWithBlob.length > 0) {
              try {
                const testRaw = await decrypt(oldKey, itemsWithBlob[0].encryptedBlob);
                if (!testRaw) {
                  sendResponse({ error: "Current master password is incorrect." });
                  break;
                }
              } catch {
                sendResponse({ error: "Current master password is incorrect." });
                break;
              }
            } else if (state.masterPassword && state.masterPassword !== oldPassword) {
              sendResponse({ error: "Current master password is incorrect." });
              break;
            }

            // 2. Derive new key
            const newKey = await deriveKey(newPassword, state.userId);

            // 3. Re-encrypt all items (including trash)
            const reEncrypted: Array<{ id: string; encryptedBlob: string }> = [];
            for (const item of state.items) {
              if (!item.encryptedBlob) continue;
              const plain = await decrypt(oldKey, item.encryptedBlob);
              const newBlob = await encrypt(newKey, plain);
              reEncrypted.push({ id: item.id, encryptedBlob: newBlob });
            }

            // 4. Batch-write to server
            if (reEncrypted.length > 0) {
              const api = await getApiClient();
              await api.reencryptItems(reEncrypted);
            }

            // 5. Update local state and in-memory session
            for (const r of reEncrypted) {
              const item = state.items.find((i) => i.id === r.id);
              if (item) item.encryptedBlob = r.encryptedBlob;
            }
            state.masterPassword = newPassword;
            state.decryptedItemsCache = {};

            await chrome.storage.session.set({ vaultr_master_password: newPassword });

            // 6. Refresh decrypted cache with new key
            await decryptAllItems();

            // 7. Reset biometric & PIN enrollment if enrolled since old key wrapped old password
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
              await chrome.storage.local.remove([
                "vaultr_biometric_enrolled",
                "vaultr_biometric_blob",
                "vaultr_pin_blob",
                "vaultr_pin_enabled",
                "vaultr_pin_failed_attempts",
              ]);
            }

            // 8. Update lastPasswordChangedAt on server profile
            const now = new Date().toISOString();
            try {
              const cleanUrl = state.serverUrl.replace(/\/+$/, "");
              await globalThis.fetch(`${cleanUrl}/api/vault/profile`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lastPasswordChangedAt: now }),
              });
            } catch (e) {
              console.warn("[Vaultr SW] Could not update profile timestamp:", e);
            }

            sendResponse({ success: true, count: reEncrypted.length });
          } catch (err: any) {
            console.error("[Vaultr SW] CHANGE_MASTER_PASSWORD error:", err);
            sendResponse({ error: err?.message || "Failed to change master password." });
          }
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
          if (sender.tab?.id) {
            updateTabBadge(sender.tab.id, sender.tab.url || message.domain);
          }
          sendResponse({
            logins: matches.map(({ id, name, domain, url, username, password, totp, hasTotp, matchedDomain }) => ({
              id,
              name,
              domain,
              url,
              username,
              password,
              totp,
              hasTotp,
              matchedDomain,
            })),
          });
          break;
        }

        case "GET_BROWSER_OVERRIDE_STATUS": {
          const isEdge = isMicrosoftEdge();
          if (isEdge) {
            // In Microsoft Edge, ensure passwordSavingEnabled is not locked false by extension
            if (chrome.privacy?.services?.passwordSavingEnabled) {
              chrome.privacy.services.passwordSavingEnabled.get({}, (details) => {
                if (details?.levelOfControl === "controlled_by_this_extension" && details?.value === false) {
                  try { chrome.privacy.services.passwordSavingEnabled.clear({}, () => {}); } catch {}
                }
              });
            }
            chrome.storage.local.get("vaultr_default_manager", (res) => {
              sendResponse({
                supported: true,
                isControlled: !!res.vaultr_default_manager,
                levelOfControl: res.vaultr_default_manager ? "controlled_by_this_extension" : "controllable_by_this_extension",
                value: false,
                isEdge: true,
              });
            });
            break;
          }

          if (!chrome.privacy?.services?.passwordSavingEnabled) {
            sendResponse({ supported: false, isControlled: false, levelOfControl: "not_supported", isEdge });
            break;
          }
          chrome.privacy.services.passwordSavingEnabled.get({}, (details) => {
            const isControlled = details?.levelOfControl === "controlled_by_this_extension";
            sendResponse({
              supported: true,
              isControlled,
              levelOfControl: details?.levelOfControl,
              value: details?.value,
              isEdge: false,
            });
          });
          break;
        }

        case "SET_BROWSER_OVERRIDE": {
          const enableOverride = !!message.enabled;
          const isEdge = isMicrosoftEdge();

          if (isEdge) {
            // On Microsoft Edge: Do NOT touch passwordSavingEnabled.set({ value: false }) because that shuts down
            // Microsoft Wallet and breaks Windows Hello passkeys.
            // Always ensure passwordSavingEnabled is cleared, and safely manage autofill address/card.
            if (chrome.privacy?.services?.passwordSavingEnabled) {
              try {
                chrome.privacy.services.passwordSavingEnabled.clear({}, () => {});
              } catch {}
            }
            if (enableOverride) {
              if (chrome.privacy?.services?.autofillAddressEnabled) {
                try { chrome.privacy.services.autofillAddressEnabled.set({ value: false }, () => {}); } catch {}
              }
              if (chrome.privacy?.services?.autofillCreditCardEnabled) {
                try { chrome.privacy.services.autofillCreditCardEnabled.set({ value: false }, () => {}); } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: true });
              sendResponse({ success: true, isControlled: true, isEdge: true });
            } else {
              if (chrome.privacy?.services?.autofillAddressEnabled) {
                try { chrome.privacy.services.autofillAddressEnabled.clear({}, () => {}); } catch {}
              }
              if (chrome.privacy?.services?.autofillCreditCardEnabled) {
                try { chrome.privacy.services.autofillCreditCardEnabled.clear({}, () => {}); } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: false });
              sendResponse({ success: true, isControlled: false, isEdge: true });
            }
            break;
          }

          if (!chrome.privacy?.services?.passwordSavingEnabled) {
            sendResponse({ success: false, error: "Privacy API not supported in this browser" });
            break;
          }

          if (enableOverride) {
            chrome.privacy.services.passwordSavingEnabled.set({ value: false }, async () => {
              if (chrome.privacy?.services?.autofillAddressEnabled) {
                try {
                  chrome.privacy.services.autofillAddressEnabled.set({ value: false }, () => {});
                } catch {}
              }
              if (chrome.privacy?.services?.autofillCreditCardEnabled) {
                try {
                  chrome.privacy.services.autofillCreditCardEnabled.set({ value: false }, () => {});
                } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: true });
              sendResponse({ success: true, isControlled: true, isEdge: false });
            });
          } else {
            chrome.privacy.services.passwordSavingEnabled.clear({}, async () => {
              if (chrome.privacy?.services?.autofillAddressEnabled) {
                try {
                  chrome.privacy.services.autofillAddressEnabled.clear({}, () => {});
                } catch {}
              }
              if (chrome.privacy?.services?.autofillCreditCardEnabled) {
                try {
                  chrome.privacy.services.autofillCreditCardEnabled.clear({}, () => {});
                } catch {}
              }
              await chrome.storage.local.set({ vaultr_default_manager: false });
              sendResponse({ success: true, isControlled: false, isEdge: false });
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
            updateAllTabBadges();
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
            updateAllTabBadges();
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
            updateAllTabBadges();
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
            updateAllTabBadges();
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
            updateAllTabBadges();
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

        case "PAGE_LOADED": {
          if (sender.tab?.id) {
            const url = message.url || sender.tab.url;
            if (url) {
              updateTabBadge(sender.tab.id, url);
            }
          }
          sendResponse({ success: true });
          break;
        }

        case "GET_SESSIONS": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            break;
          }
          try {
            const cleanUrl = state.serverUrl.replace(/\/+$/, "");
            const res = await globalThis.fetch(`${cleanUrl}/api/settings/sessions`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              sendResponse({ sessions: data.sessions || [] });
            } else {
              const errData = await res.json().catch(() => ({}));
              sendResponse({ error: errData.error || "Failed to load active sessions" });
            }
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to load active sessions" });
          }
          break;
        }

        case "REVOKE_SESSION": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            break;
          }
          try {
            const cleanUrl = state.serverUrl.replace(/\/+$/, "");
            const sid = encodeURIComponent(message.sessionId || "");
            const res = await globalThis.fetch(`${cleanUrl}/api/settings/sessions/${sid}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (res.ok) {
              sendResponse({ success: true });
            } else {
              const errData = await res.json().catch(() => ({}));
              sendResponse({ error: errData.error || "Failed to revoke session" });
            }
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to revoke session" });
          }
          break;
        }

        case "REVOKE_ALL_SESSIONS": {
          await tryRestoreSession();
          if (!state.isUnlocked) {
            sendResponse({ error: "Vault is locked" });
            break;
          }
          try {
            const cleanUrl = state.serverUrl.replace(/\/+$/, "");
            const res = await globalThis.fetch(`${cleanUrl}/api/settings/sessions`, {
              method: "DELETE",
              credentials: "include",
            });
            if (res.ok) {
              sendResponse({ success: true });
            } else {
              const errData = await res.json().catch(() => ({}));
              sendResponse({ error: errData.error || "Failed to revoke sessions" });
            }
          } catch (err: any) {
            sendResponse({ error: err?.message || "Failed to revoke sessions" });
          }
          break;
        }

        case "UPDATE_BADGES": {
          await updateAllTabBadges();
          sendResponse({ success: true });
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
  tryRestoreSession().then(() => updateAllTabBadges());
});

chrome.runtime.onStartup?.addListener(() => {
  setupContextMenus();
  tryRestoreSession().then(() => updateAllTabBadges());
});

// Tab listeners to maintain autofill suggestions badge on extension icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    const url = changeInfo.url || tab.url;
    if (url) {
      updateTabBadge(tabId, url);
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.id && tab.url) {
      updateTabBadge(tab.id, tab.url);
    }
  } catch {}
});

// React immediately when badge preference or domain matching toggles change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.vaultr_show_badge_count !== undefined) {
      const isEnabled = changes.vaultr_show_badge_count.newValue !== false;
      if (!isEnabled) {
        clearAllBadges();
      } else {
        updateAllTabBadges();
      }
    } else if (changes.vaultr_subdomain_matching !== undefined) {
      updateAllTabBadges();
    }
  }
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

