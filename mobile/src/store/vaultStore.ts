import { create } from "zustand";
import { VaultItem, VaultrApiClient, deriveKey, decrypt, encrypt, NewVaultItemPayload, Template } from "@vaultr/core";
import { cacheVaultItems, getCachedVaultItems, flushOfflineQueue, queueOfflineAction } from "../services/sync";
import { unlockWithBiometrics, clearBiometricPassword } from "../services/biometrics";
import { saveAccountSession, getSavedAccountSession, clearAccountSession, AccountUser } from "../services/auth";
import { syncAutofillCredentials } from "../services/autofill";
import { Platform } from "react-native";
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

interface VaultState {
  // Auth state
  accountUser: AccountUser | null;
  accountToken: string | null;
  isAuthenticated: boolean;

  // Vault state
  items: VaultItem[];
  cryptoKey: CryptoKey | Uint8Array | null;
  masterPassword: string | null;
  isUnlocked: boolean;
  isLoading: boolean;
  serverUrl: string;
  searchQuery: string;
  selectedFolder: string; // 'ALL', folder name
  selectedTemplate: string; // 'ALL', 'login', 'card', etc.

  // Actions
  initSession: () => Promise<void>;
  syncUserProfile: () => Promise<void>;
  signInAccount: (email: string, pass: string, url: string) => Promise<void>;
  registerAccount: (name: string, username: string, email: string, pass: string, url: string) => Promise<void>;
  signInWithGoogle: (url?: string) => Promise<void>;
  updateAccountUser: (updates: Partial<AccountUser>) => Promise<void>;
  signOutAccount: () => Promise<void>;
  setServerUrl: (url: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedTemplate: (template: string) => void;
  unlock: (masterPassword: string, customServerUrl?: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  fetchItems: () => Promise<void>;
  decryptItemBlob: (blob: string) => Promise<string>;

  // CRUD actions
  createItem: (params: {
    name: string;
    unencryptedPayload: any;
    template?: Template;
    folder?: string;
    domain?: string;
    favorite?: boolean;
    hasTotp?: boolean;
    tags?: string[];
  }) => Promise<VaultItem>;
  updateItem: (
    id: string,
    params: {
      name?: string;
      unencryptedPayload?: any;
      template?: Template;
      folder?: string;
      domain?: string;
      favorite?: boolean;
      hasTotp?: boolean;
      tags?: string[];
    }
  ) => Promise<VaultItem>;
  trashItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

/** Helper to instantiate an authenticated VaultrApiClient using current store state. */
function getApiClient(): VaultrApiClient {
  const { serverUrl, accountToken } = useVaultStore.getState();
  return new VaultrApiClient({
    baseUrl: serverUrl,
    getToken: () => accountToken || "",
    getCookies: () => (accountToken ? `better-auth.session_token=${accountToken}` : ""),
    customFetch: (url, init = {}) => {
      const headers = new Headers(init.headers || {});
      headers.set("User-Agent", `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`);
      return fetch(url, { ...init, headers });
    },
  });
}

export const useVaultStore = create<VaultState>((set, get) => ({
  accountUser: null,
  accountToken: null,
  isAuthenticated: false,

  items: [],
  cryptoKey: null,
  masterPassword: null,
  isUnlocked: false,
  isLoading: false,
  serverUrl: "http://localhost:3000",
  searchQuery: "",
  selectedFolder: "ALL",
  selectedTemplate: "ALL",

  initSession: async () => {
    const { token, user, serverUrl } = await getSavedAccountSession();
    if (serverUrl) set({ serverUrl });
    if (token && user) {
      set({ accountToken: token, accountUser: user, isAuthenticated: true });
      get().syncUserProfile();
    }
  },

  syncUserProfile: async () => {
    const { accountToken, serverUrl, accountUser } = get();
    if (!accountToken || !serverUrl) return;
    try {
      const cleanUrl = serverUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accountToken}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          console.warn("[VaultStore] Session revoked on server during sync (401), logging out mobile device...");
          await get().signOutAccount();
        }
        return;
      }

      const data = await res.json();
      if (data.id) {
        const updatedUser: AccountUser = {
          id: data.id,
          email: data.email || accountUser?.email || "",
          name: data.displayName || data.name || accountUser?.name || "",
          image: data.avatarUrl || data.image || accountUser?.image,
          avatarUrl: data.avatarUrl || data.image || accountUser?.avatarUrl,
        };
        await saveAccountSession(accountToken, updatedUser, cleanUrl);
        set({ accountUser: updatedUser });
      }
    } catch (err) {
      // Network errors (offline) should be ignored, don't log out.
      console.warn("[VaultStore] Failed to sync user profile", err);
    }
  },

  signInAccount: async (email, password, url) => {
    set({ isLoading: true });
    try {
      const cleanUrl = url.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
          "Origin": cleanUrl,
          "Referer": `${cleanUrl}/`,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let errorMessage = "Invalid email or password.";
        try {
          const errData = await res.json();
          if (errData.message || errData.error) {
            errorMessage = errData.message || errData.error;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await res.json();
      const user: AccountUser = {
        id: data.user?.id || data.session?.userId || "user_" + Date.now(),
        email: data.user?.email || email,
        name: data.user?.name || email.split("@")[0],
        image: data.user?.image,
      };
      const token = data.token || data.session?.token || data.session?.id || "";

      await saveAccountSession(token, user, cleanUrl);
      set({
        accountToken: token,
        accountUser: user,
        isAuthenticated: true,
        serverUrl: cleanUrl,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  registerAccount: async (name, username, email, password, url) => {
    set({ isLoading: true });
    try {
      const cleanUrl = url.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
          "Origin": cleanUrl,
          "Referer": `${cleanUrl}/`,
        },
        body: JSON.stringify({ name, username, email, password }),
      });

      if (!res.ok) {
        let errorMessage = "Registration failed.";
        try {
          const errData = await res.json();
          if (errData.message || errData.error) {
            errorMessage = errData.message || errData.error;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await res.json();
      const user: AccountUser = {
        id: data.user?.id || "user_" + Date.now(),
        email: data.user?.email || email,
        name: data.user?.name || name,
        image: data.user?.image,
      };
      const token = data.token || data.session?.token || data.session?.id || "";

      await saveAccountSession(token, user, cleanUrl);
      set({
        accountToken: token,
        accountUser: user,
        isAuthenticated: true,
        serverUrl: cleanUrl,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  signInWithGoogle: async (url) => {
    set({ isLoading: true });
    try {
      const cleanUrl = (url || get().serverUrl).replace(/\/+$/, "");
      const redirectUri = Linking.createURL("auth-callback");
      const callbackURL = `${cleanUrl}/api/auth/mobile-callback?appUrl=${encodeURIComponent(redirectUri)}`;

      const res = await fetch(`${cleanUrl}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
          "Origin": cleanUrl,
          "Referer": `${cleanUrl}/`,
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL,
        }),
      });

      if (!res.ok) {
        let errMsg = "Google OAuth is not configured or failed on this server.";
        try {
          const errData = await res.json();
          if (errData.message || errData.error) errMsg = errData.message || errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!data.url) throw new Error("Server did not return a valid Google auth URL.");

      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (authResult.type === "success" && authResult.url) {
        const redirectUri = authResult.url;
        const queryStr = redirectUri.includes("?") ? redirectUri.split("?")[1] : "";
        const params = new URLSearchParams(queryStr);
        const token = params.get("token");
        const id = params.get("id");
        const email = params.get("email");
        const name = params.get("name");

        if (token && id) {
          const user: AccountUser = {
            id,
            email: email || "google-user@vaultr.local",
            name: name || "Google User",
          };
          await saveAccountSession(token, user, cleanUrl);
          set({
            accountToken: token,
            accountUser: user,
            isAuthenticated: true,
            serverUrl: cleanUrl,
            isLoading: false,
          });
          return;
        }
      }

      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateAccountUser: async (updates) => {
    const { accountUser, accountToken, serverUrl } = get();
    if (!accountUser) return;
    const img = updates.image ?? updates.avatarUrl ?? accountUser.image ?? accountUser.avatarUrl;
    const newUser: AccountUser = {
      ...accountUser,
      ...updates,
      image: img,
      avatarUrl: img,
    };
    if (accountToken && serverUrl) {
      await saveAccountSession(accountToken, newUser, serverUrl);
    }
    set({ accountUser: newUser });
  },

  signOutAccount: async () => {
    const { serverUrl, accountToken } = get();
    if (serverUrl && accountToken) {
      const cleanUrl = serverUrl.replace(/\/+$/, "");
      try {
        await fetch(`${cleanUrl}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accountToken}`,
            "Cookie": `better-auth.session_token=${accountToken}`,
            "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
          },
        });
      } catch (err) {
        console.warn("[VaultStore] Failed to sign out on server", err);
      }
    }

    await clearBiometricPassword();
    await clearAccountSession();
    get().lock();
    set({
      accountToken: null,
      accountUser: null,
      isAuthenticated: false,
    });
  },

  setServerUrl: (serverUrl) => set({ serverUrl }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),

  unlock: async (masterPassword, customServerUrl) => {
    set({ isLoading: true });
    try {
      const serverUrl = customServerUrl || get().serverUrl;
      const { accountUser, accountToken } = get();
      const salt = accountUser?.id || "vaultr_default_salt";
      const key = await deriveKey(masterPassword, salt);

      const api = new VaultrApiClient({
        baseUrl: serverUrl,
        getToken: () => accountToken || "",
        getCookies: () => (accountToken ? `better-auth.session_token=${accountToken}` : ""),
      });

      let items: VaultItem[] = [];
      try {
        items = await api.getItems();
        await cacheVaultItems(items);
        await flushOfflineQueue(api);
      } catch (err: any) {
        if (err?.status === 401 || (err?.message && (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")))) {
          console.warn("[VaultStore] Session revoked on server (401) during unlock, logging out mobile device...");
          await get().signOutAccount();
          throw new Error("Session revoked. Please sign in again.");
        }
        console.warn("[VaultStore] Remote fetch failed during unlock, loading offline cache:", err);
        items = await getCachedVaultItems();
      }

      // Zero-Knowledge Master Password Validation: test decrypting a sample item
      const testItem = items.find((i) => !!i.encryptedBlob);
      if (testItem) {
        try {
          await decrypt(key, testItem.encryptedBlob);
        } catch (err) {
          throw new Error("Incorrect master password.");
        }
      }

      set({
        cryptoKey: key,
        masterPassword,
        items,
        isUnlocked: true,
        isLoading: false,
        serverUrl,
      });

      // Async sync logins to native AutofillCredentialStore
      setTimeout(() => {
        syncAutofillStore();
      }, 100);
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  unlockWithBiometrics: async () => {
    const res = await unlockWithBiometrics();
    if (!res.success || !res.password) return false;
    await get().unlock(res.password);
    return true;
  },

  lock: () => {
    set({
      items: [],
      cryptoKey: null,
      masterPassword: null,
      isUnlocked: false,
    });
  },

  fetchItems: async () => {
    const api = getApiClient();
    get().syncUserProfile();
    try {
      const items = await api.getItems();
      await cacheVaultItems(items);
      set({ items });
    } catch (err: any) {
      if (err?.status === 401 || (err?.message && (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")))) {
        console.warn("[VaultStore] Session revoked on server (401), logging out mobile device...");
        await get().signOutAccount();
        return;
      }
      console.error("[VaultStore] Failed to fetch online items, loading cache:", err);
      const cached = await getCachedVaultItems();
      set({ items: cached });
    }
  },

  decryptItemBlob: async (blob: string) => {
    const { cryptoKey } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    return decrypt(cryptoKey, blob);
  },

  createItem: async (params) => {
    const { cryptoKey, items } = get();
    if (!cryptoKey) throw new Error("Vault is locked");

    const encryptedBlob = await encrypt(cryptoKey, JSON.stringify(params.unencryptedPayload));
    const payload: NewVaultItemPayload = {
      name: params.name,
      encryptedBlob,
      domain: params.domain,
      folder: params.folder,
      template: params.template || "login",
      favorite: params.favorite || false,
      hasTotp: params.hasTotp || false,
      tags: params.tags || [],
    };

    const api = getApiClient();
    let createdItem: VaultItem;
    try {
      createdItem = await api.createItem(payload);
    } catch (err) {
      console.warn("[VaultStore] Network request failed, queueing create offline:", err);
      createdItem = {
        id: "offline_" + Date.now(),
        name: payload.name,
        encryptedBlob: payload.encryptedBlob,
        domain: payload.domain,
        folder: payload.folder,
        template: payload.template,
        favorite: payload.favorite,
        hasTotp: payload.hasTotp,
        tags: payload.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await queueOfflineAction({ type: "create", payload });
    }

    const updatedItems = [createdItem, ...items];
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
    return createdItem;
  },

  updateItem: async (id, params) => {
    const { cryptoKey, items } = get();
    if (!cryptoKey) throw new Error("Vault is locked");

    const existing = items.find((i) => i.id === id);
    if (!existing) throw new Error("Item not found");

    const patch: Partial<VaultItem> = {};
    if (params.name !== undefined) patch.name = params.name;
    if (params.domain !== undefined) patch.domain = params.domain;
    if (params.folder !== undefined) patch.folder = params.folder;
    if (params.template !== undefined) patch.template = params.template;
    if (params.favorite !== undefined) patch.favorite = params.favorite;
    if (params.hasTotp !== undefined) patch.hasTotp = params.hasTotp;
    if (params.tags !== undefined) patch.tags = params.tags;

    if (params.unencryptedPayload !== undefined) {
      patch.encryptedBlob = await encrypt(cryptoKey, JSON.stringify(params.unencryptedPayload));
    }

    const api = getApiClient();
    let updated: VaultItem;
    try {
      updated = await api.updateItem(id, patch);
    } catch (err) {
      console.warn("[VaultStore] Network request failed, queueing update offline:", err);
      updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      await queueOfflineAction({ type: "update", payload: { id, patch } });
    }

    const updatedItems = items.map((i) => (i.id === id ? updated : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
    return updated;
  },

  trashItem: async (id) => {
    const { items } = get();
    const deletedAt = new Date().toISOString();
    const api = getApiClient();

    try {
      await api.updateItem(id, { deletedAt });
    } catch (err) {
      console.warn("[VaultStore] Network request failed, queueing trash offline:", err);
      await queueOfflineAction({ type: "update", payload: { id, patch: { deletedAt } } });
    }

    const updatedItems = items.map((i) => (i.id === id ? { ...i, deletedAt } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
  },

  restoreItem: async (id) => {
    const { items } = get();
    const api = getApiClient();

    try {
      await api.updateItem(id, { deletedAt: null });
    } catch (err) {
      console.warn("[VaultStore] Network request failed, queueing restore offline:", err);
      await queueOfflineAction({ type: "update", payload: { id, patch: { deletedAt: null } } });
    }

    const updatedItems = items.map((i) => (i.id === id ? { ...i, deletedAt: null } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
  },

  deleteItem: async (id) => {
    const { items } = get();
    const api = getApiClient();

    try {
      await api.hardDeleteItem(id);
    } catch (err) {
      console.warn("[VaultStore] Network request failed, queueing delete offline:", err);
      await queueOfflineAction({ type: "delete", payload: { id } });
    }

    const updatedItems = items.filter((i) => i.id !== id);
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
  },

  toggleFavorite: async (id) => {
    const { items } = get();
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newFav = !target.favorite;
    const api = getApiClient();

    try {
      await api.updateItem(id, { favorite: newFav });
    } catch (err) {
      await queueOfflineAction({ type: "update", payload: { id, patch: { favorite: newFav } } });
    }

    const updatedItems = items.map((i) => (i.id === id ? { ...i, favorite: newFav } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems);
  },
}));

/** Decrypts active login entries in background and syncs credentials to native AutofillCredentialStore. */
async function syncAutofillStore() {
  const { items, cryptoKey } = useVaultStore.getState();
  if (!cryptoKey) return;
  const loginItems = items.filter((i) => (i.template || "login") === "login" && !i.deletedAt);
  const datasets: any[] = [];
  for (const item of loginItems) {
    try {
      const raw = await decrypt(cryptoKey, item.encryptedBlob);
      const p = JSON.parse(raw);
      if (p.username || p.password) {
        datasets.push({
          id: item.id,
          name: item.name,
          domain: item.domain || p.url,
          username: p.username || "",
          password: p.password || "",
        });
      }
    } catch {}
  }
  await syncAutofillCredentials(datasets);
}


