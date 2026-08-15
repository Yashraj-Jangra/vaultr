import { create } from "zustand";
import { VaultItem, VaultrApiClient, deriveKey, decrypt, encrypt, encryptBinary, decryptBinary, NewVaultItemPayload, Template } from "@vaultr/core";
import { cacheVaultItems, getCachedVaultItems, clearCachedVaultItems } from "../services/sync";
import { unlockWithBiometrics, clearBiometricPassword } from "../services/biometrics";
import { saveAccountSession, getSavedAccountSession, clearAccountSession, AccountUser } from "../services/auth";
import { syncAutofillCredentials, clearAutofillCredentials } from "../services/autofill";
import { probeServerConnection, startConnectivityMonitor } from "../services/connectivity";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  isOnline: boolean;
  serverUrl: string;
  searchQuery: string;
  selectedFolder: string; // 'ALL', folder name
  selectedTemplate: string; // 'ALL', 'login', 'card', etc.
  customFolders: string[];

  // Connectivity
  checkConnection: () => Promise<boolean>;

  // Attachments
  fetchAttachments: (vaultItemId: string) => Promise<Array<{ id: string; name: string; sizeBytes: number; mimeType: string; createdAt: string }>>;
  uploadAttachment: (vaultItemId: string, doc: { uri: string; name: string; mimeType: string; size?: number }) => Promise<any>;
  downloadAndDecryptAttachment: (attachmentId: string, encryptedName: string) => Promise<{ name: string; bytes: Uint8Array }>;
  deleteAttachment: (attachmentId: string) => Promise<void>;

  // Actions
  setServerUrl: (url: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedTemplate: (template: string) => void;

  // Folder Actions
  loadFolders?: () => Promise<void>;
  createFolder?: (name: string) => Promise<void>;
  addCustomFolder: (folderPath: string) => Promise<void>;
  renameFolder: (from: string, to: string) => Promise<void>;
  deleteFolder: (name: string, disposition?: "uncategorize" | "trash") => Promise<void>;

  // Auth actions
  initSession: () => Promise<void>;
  signInAccount: (email: string, password: string, url: string) => Promise<void>;
  registerAccount: (name: string, username: string, email: string, password: string, url: string) => Promise<void>;
  signInWithGoogle: (serverUrl?: string) => Promise<void>;
  updateAccountUser: (updates: Partial<AccountUser>) => Promise<void>;
  signOutAccount: () => Promise<void>;
  syncUserProfile: () => Promise<void>;

  // Key / Lock actions
  unlock: (masterPassword: string, customServerUrl?: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  fetchItems: () => Promise<void>;
  refreshItems: () => Promise<void>;
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
  batchAction: (action: "trash" | "restore" | "purge" | "move", ids: string[], payload?: any) => Promise<void>;
  reencryptAllItems: (reEncrypted: Array<{ id: string; encryptedBlob: string }>) => Promise<void>;
  bulkImportItems: (
    itemsToImport: Array<{
      updateId?: string;
      name: string;
      folder?: string;
      template: Template;
      payload: any;
    }>,
    onProgress?: (percent: number) => void
  ) => Promise<{
    inserted: number;
    updated: number;
    insertedIds: string[];
    failedItems: Array<{ name: string; reason: string }>;
  }>;
}

/** Helper to instantiate an authenticated VaultrApiClient using current store state. */
function getApiClient(): VaultrApiClient {
  const { serverUrl, accountToken } = useVaultStore.getState();
  return new VaultrApiClient({
    baseUrl: serverUrl,
    getToken: () => accountToken || "",
    getCookies: () => (accountToken ? `better-auth.session_token=${accountToken}` : ""),
    customFetch: (url: string | URL | Request, init: RequestInit = {}) => {
      const rawHeaders = init.headers;
      const headers: Record<string, string> = {};
      if (rawHeaders) {
        if (typeof (rawHeaders as any).forEach === "function") {
          (rawHeaders as any).forEach((value: string, key: string) => {
            headers[key] = value;
          });
        } else if (Array.isArray(rawHeaders)) {
          rawHeaders.forEach(([k, v]) => {
            headers[k] = v;
          });
        } else if (typeof rawHeaders === "object") {
          Object.assign(headers, rawHeaders);
        }
      }
      headers["User-Agent"] = `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`;
      return fetch(url as any, { ...init, headers });
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
  isOnline: true,
  serverUrl: "https://vaultr.cvweb.qzz.io",
  searchQuery: "",
  selectedFolder: "ALL",
  selectedTemplate: "ALL",
  customFolders: [],

  checkConnection: async () => {
    const { serverUrl } = get();
    const online = await probeServerConnection(serverUrl);
    set({ isOnline: online });
    if (online && get().isUnlocked) {
      await get().fetchItems().catch(() => {});
    }
    return online;
  },

  initSession: async () => {
    const { token, user, serverUrl } = await getSavedAccountSession();
    if (serverUrl) set({ serverUrl });
    if (token && user) {
      set({ accountToken: token, accountUser: user, isAuthenticated: true });
      get().syncUserProfile();
    }

    // Start background connectivity monitor
    startConnectivityMonitor(
      () => get().serverUrl,
      (online) => set({ isOnline: online }),
      () => {
        if (get().isUnlocked) {
          get().fetchItems().catch(() => {});
        }
      }
    );
  },

  syncUserProfile: async () => {
    const { accountToken, serverUrl, accountUser } = get();
    if (!accountToken || !serverUrl) return;
    try {
      const cleanUrl = serverUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/me`, {
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

  signInAccount: async (email: string, password: string, url: string) => {
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

  registerAccount: async (name: string, username: string, email: string, password: string, url: string) => {
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

  updateAccountUser: async (updates: Partial<AccountUser>) => {
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
    const { serverUrl, accountToken, accountUser } = get();
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

    if (accountUser?.id) {
      await clearCachedVaultItems(accountUser.id);
    }
    await clearAutofillCredentials();
    await clearBiometricPassword();
    await clearAccountSession();
    get().lock();
    set({
      accountToken: null,
      accountUser: null,
      isAuthenticated: false,
    });
  },

  setServerUrl: async (serverUrl: string) => { set({ serverUrl }); },
  setSearchQuery: (searchQuery: string) => { set({ searchQuery }); },
  setSelectedFolder: (selectedFolder: string) => { set({ selectedFolder }); },
  setSelectedTemplate: (selectedTemplate: string) => { set({ selectedTemplate }); },

  unlock: async (masterPassword: string, customServerUrl?: string) => {
    set({ isLoading: true });
    try {
      const serverUrl = customServerUrl || get().serverUrl;
      const { accountUser, accountToken } = get();
      const salt = accountUser?.id || "vaultr_default_salt";

      const api = new VaultrApiClient({
        baseUrl: serverUrl,
        getToken: () => accountToken || "",
        getCookies: () => (accountToken ? `better-auth.session_token=${accountToken}` : ""),
      });

      let isOnline = true;

      // ⚡ Parallel: derive crypto key AND fetch items concurrently
      const [key, items] = await Promise.all([
        deriveKey(masterPassword, salt),
        api.getItems().then(async (fetched) => {
          await cacheVaultItems(fetched, accountUser?.id);
          return fetched;
        }).catch(async (err: any) => {
          if (
            err?.status === 401 ||
            (err?.message &&
              (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")))
          ) {
            console.warn("[VaultStore] Session revoked on server (401) during unlock, logging out mobile device...");
            await get().signOutAccount();
            throw new Error("Session revoked. Please sign in again.");
          }
          console.warn("[VaultStore] Remote fetch failed during unlock, loading offline cache:", err);
          isOnline = false;
          const cached = await getCachedVaultItems(accountUser?.id);
          if (!cached || cached.length === 0) {
            throw new Error("No internet connection and no offline cached data found. Connect to internet to load your vault.");
          }
          return cached;
        }),
      ]);

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
        isOnline,
        serverUrl,
      });

      // ⚡ Non-blocking: autofill sync after vault opens
      setTimeout(() => {
        syncAutofillStore();
      }, 0);
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
    clearAutofillCredentials();
    set({
      items: [],
      cryptoKey: null,
      masterPassword: null,
      isUnlocked: false,
    });
  },

  fetchItems: async () => {
    const api = getApiClient();
    const { accountUser } = get();
    get().syncUserProfile();
    try {
      const items = await api.getItems();
      await cacheVaultItems(items, accountUser?.id);
      set({ items, isOnline: true });

      // Sync server folders (including empty custom folders)
      try {
        const serverFolders = await api.getFolders();
        const cleanServerFolders = (serverFolders || []).map((f: any) => typeof f === "string" ? f : f?.name || f?.path || "").filter(Boolean);
        const cleanCurrentCustom = (get().customFolders || []).map((f: any) => typeof f === "string" ? f : f?.name || f?.path || "").filter(Boolean);
        const mergedCustom = Array.from(new Set([...cleanCurrentCustom, ...cleanServerFolders])).sort();
        set({ customFolders: mergedCustom });
        if (accountUser?.id) {
          await AsyncStorage.setItem(`vaultr_custom_folders_${accountUser.id}`, JSON.stringify(mergedCustom));
        }
      } catch {}
    } catch (err: any) {
      if (err?.status === 401 || (err?.message && (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")))) {
        console.warn("[VaultStore] Session revoked on server (401), logging out mobile device...");
        await get().signOutAccount();
        return;
      }
      console.warn("[VaultStore] Failed to fetch online items, loading cache:", err);
      const cached = await getCachedVaultItems(accountUser?.id);
      set({ items: cached, isOnline: false });
    }
  },

  refreshItems: async () => {
    return get().fetchItems();
  },

  decryptItemBlob: async (blob: string) => {
    const { cryptoKey } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    return decrypt(cryptoKey, blob);
  },

  createItem: async (params) => {
    const { cryptoKey, isOnline, accountUser } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    if (!isOnline) {
      throw new Error("Internet connection is required to create items.");
    }

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
    const createdItem = await api.createItem(payload);
    const updatedItems = [createdItem, ...get().items.filter((i) => i.id !== createdItem.id)];
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
    return createdItem;
  },

  updateItem: async (id, params) => {
    const { cryptoKey, items, isOnline, accountUser } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    if (!isOnline) {
      throw new Error("Internet connection is required to update items.");
    }

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
    const serverUpdated = await api.updateItem(id, patch);
    const finalItems = get().items.map((i) => (i.id === id ? serverUpdated : i));
    set({ items: finalItems });
    await cacheVaultItems(finalItems, accountUser?.id);
    return serverUpdated;
  },

  trashItem: async (id) => {
    const { isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to move items to trash.");
    }
    const deletedAt = new Date().toISOString();
    const api = getApiClient();
    await api.updateItem(id, { deletedAt });
    const updatedItems = get().items.map((i) => (i.id === id ? { ...i, deletedAt } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  restoreItem: async (id) => {
    const { isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to restore items.");
    }
    const api = getApiClient();
    await api.updateItem(id, { deletedAt: null });
    const updatedItems = get().items.map((i) => (i.id === id ? { ...i, deletedAt: null } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  deleteItem: async (id) => {
    const { isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to permanently delete items.");
    }
    const api = getApiClient();
    await api.hardDeleteItem(id);
    const updatedItems = get().items.filter((i) => i.id !== id);
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  toggleFavorite: async (id) => {
    const { items, isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to update favorites.");
    }
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newFav = !target.favorite;
    const api = getApiClient();
    await api.updateItem(id, { favorite: newFav });
    const updatedItems = get().items.map((i) => (i.id === id ? { ...i, favorite: newFav } : i));
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  addCustomFolder: async (folderPath: string) => {
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    const { customFolders, accountUser, isOnline } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to create folders.");
    }
    const api = getApiClient();
    await api.createFolder(trimmed);

    const parts = trimmed.split("/").filter(Boolean);
    const toAdd: string[] = [];
    let curr = "";
    for (const p of parts) {
      curr = curr ? `${curr}/${p}` : p;
      toAdd.push(curr);
    }

    const next = Array.from(new Set([...customFolders, ...toAdd])).sort();
    set({ customFolders: next });
    if (accountUser?.id) {
      try {
        await AsyncStorage.setItem(`vaultr_custom_folders_${accountUser.id}`, JSON.stringify(next));
      } catch {}
    }
  },

  renameFolder: async (from: string, to: string) => {
    const { items, customFolders, accountUser, isOnline } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to rename folders.");
    }
    const api = getApiClient();
    await api.renameFolder(from, to);

    const fromPrefix = `${from}/`;
    const fromLen = from.length;

    const updatedItems = items.map((item) => {
      if (!item.folder) return item;
      if (item.folder === from) {
        return { ...item, folder: to, updatedAt: new Date().toISOString() };
      }
      if (item.folder.startsWith(fromPrefix)) {
        const sub = item.folder.slice(fromLen);
        return { ...item, folder: `${to}${sub}`, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    const updatedCustom = customFolders.map((f) => {
      if (f === from) return to;
      if (f.startsWith(fromPrefix)) return `${to}${f.slice(fromLen)}`;
      return f;
    });

    const nextCustom = Array.from(new Set(updatedCustom)).sort();
    set({ items: updatedItems, customFolders: nextCustom });
    await cacheVaultItems(updatedItems, accountUser?.id);
    if (accountUser?.id) {
      try {
        await AsyncStorage.setItem(`vaultr_custom_folders_${accountUser.id}`, JSON.stringify(nextCustom));
      } catch {}
    }
  },

  deleteFolder: async (folderName: string, disposition = "uncategorize") => {
    const { items, customFolders, accountUser, isOnline } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to delete folders.");
    }
    const api = getApiClient();
    await api.deleteFolder(folderName, disposition);

    const namePrefix = `${folderName}/`;
    const now = new Date().toISOString();

    const updatedItems = items.map((item) => {
      if (!item.folder) return item;
      const isTarget = item.folder === folderName || item.folder.startsWith(namePrefix);
      if (!isTarget) return item;

      if (disposition === "trash") {
        return { ...item, deletedAt: now, updatedAt: now };
      } else {
        return { ...item, folder: undefined, updatedAt: now };
      }
    });

    const nextCustom = customFolders.filter(
      (f) => f !== folderName && !f.startsWith(namePrefix)
    );

    set({ items: updatedItems, customFolders: nextCustom });
    await cacheVaultItems(updatedItems, accountUser?.id);
    if (accountUser?.id) {
      try {
        await AsyncStorage.setItem(`vaultr_custom_folders_${accountUser.id}`, JSON.stringify(nextCustom));
      } catch {}
    }
  },

  batchAction: async (action, ids, payload) => {
    if (!ids || ids.length === 0) return;
    const { items, isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required for batch actions.");
    }

    const api = getApiClient();
    await api.batchAction(action, ids, payload);

    const idSet = new Set(ids);
    let updatedItems = [...items];
    const now = new Date().toISOString();

    if (action === "trash") {
      updatedItems = items.map((i) => (idSet.has(i.id) ? { ...i, deletedAt: now } : i));
    } else if (action === "restore") {
      updatedItems = items.map((i) => (idSet.has(i.id) ? { ...i, deletedAt: null } : i));
    } else if (action === "purge") {
      updatedItems = items.filter((i) => !idSet.has(i.id));
    } else if (action === "move" && payload?.folder !== undefined) {
      updatedItems = items.map((i) => (idSet.has(i.id) ? { ...i, folder: payload.folder, updatedAt: now } : i));
    }

    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  reencryptAllItems: async (reEncrypted) => {
    if (!reEncrypted || reEncrypted.length === 0) return;
    const { isOnline, accountUser } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to re-encrypt items.");
    }
    const blobMap = new Map(reEncrypted.map((r) => [r.id, r.encryptedBlob]));
    const now = new Date().toISOString();

    const api = getApiClient();
    await api.reencryptItems(reEncrypted);

    const updatedItems = get().items.map((i) =>
      blobMap.has(i.id) ? { ...i, encryptedBlob: blobMap.get(i.id)!, updatedAt: now } : i
    );
    set({ items: updatedItems });
    await cacheVaultItems(updatedItems, accountUser?.id);
  },

  fetchAttachments: async (vaultItemId: string) => {
    const { cryptoKey } = get();
    if (!cryptoKey) return [];
    const api = getApiClient();
    const list = await api.getAttachments(vaultItemId);
    const decryptedList = [];
    for (const item of list) {
      try {
        const name = await decrypt(cryptoKey, item.encryptedName);
        decryptedList.push({
          id: item.id,
          name,
          sizeBytes: item.sizeBytes,
          mimeType: item.mimeType,
          createdAt: item.createdAt,
        });
      } catch {
        decryptedList.push({
          id: item.id,
          name: "Encrypted File",
          sizeBytes: item.sizeBytes,
          mimeType: item.mimeType,
          createdAt: item.createdAt,
        });
      }
    }
    return decryptedList;
  },

  uploadAttachment: async (vaultItemId: string, doc: { uri: string; name: string; mimeType: string; size?: number }) => {
    const { cryptoKey, isOnline } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    if (!isOnline) {
      throw new Error("Internet connection is required to upload attachments.");
    }

    // Read file bytes from local device URI
    const res = await fetch(doc.uri);
    const arrayBuffer = await res.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);

    // Encrypt file contents and filename with AES-256-GCM
    const encryptedBytes = await encryptBinary(cryptoKey, rawBytes);
    const encryptedName = await encrypt(cryptoKey, doc.name);

    const formData = new FormData();
    formData.append("vaultItemId", vaultItemId);
    formData.append("encryptedName", encryptedName);
    formData.append("mimeType", doc.mimeType || "application/octet-stream");

    // Pass encrypted file as binary blob to standard multipart form
    formData.append("encryptedFile", new Blob([encryptedBytes as any], { type: "application/octet-stream" }) as any);

    const api = getApiClient();
    return await api.uploadAttachment(formData);
  },

  downloadAndDecryptAttachment: async (attachmentId: string, encryptedName: string) => {
    const { cryptoKey } = get();
    if (!cryptoKey) throw new Error("Vault is locked");

    const api = getApiClient();
    const encryptedArrayBuffer = await api.downloadAttachment(attachmentId);
    const encryptedBytes = new Uint8Array(encryptedArrayBuffer);

    const decryptedBytes = await decryptBinary(cryptoKey, encryptedBytes);
    let name = "attachment.bin";
    try {
      name = await decrypt(cryptoKey, encryptedName);
    } catch {}

    return { name, bytes: decryptedBytes };
  },

  deleteAttachment: async (attachmentId: string) => {
    const { isOnline } = get();
    if (!isOnline) {
      throw new Error("Internet connection is required to delete attachments.");
    }
    const api = getApiClient();
    await api.deleteAttachment(attachmentId);
  },

  bulkImportItems: async (itemsToImport, onProgress) => {
    const { cryptoKey, isOnline } = get();
    if (!cryptoKey) throw new Error("Vault is locked");
    if (!isOnline) {
      throw new Error("Internet connection is required to import items.");
    }

    const CHUNK_SIZE = 50;
    let totalInserted = 0;
    let totalUpdated = 0;
    const allInsertedIds: string[] = [];
    const allFailedItems: Array<{ name: string; reason: string }> = [];
    const api = getApiClient();

    for (let i = 0; i < itemsToImport.length; i += CHUNK_SIZE) {
      const chunk = itemsToImport.slice(i, i + CHUNK_SIZE);
      const validEncryptedItems: any[] = [];

      for (const item of chunk) {
        try {
          const encryptedBlob = await encrypt(cryptoKey, JSON.stringify(item.payload));
          const primaryUrl = item.payload.url || (item.payload.urls && item.payload.urls[0]) || "";
          let domain: string | null = null;
          if (primaryUrl) {
            const trimmed = primaryUrl.trim().toLowerCase();
            if (trimmed.startsWith("androidapp:")) {
              domain = trimmed;
            } else {
              const withoutScheme = trimmed.replace(/^[a-zA-Z]+:\/\//, "");
              const host = withoutScheme.split("/")[0]?.split("?")[0]?.split("#")[0]?.split(":")[0];
              domain = host && host.length > 0 ? host : null;
            }
          }

          validEncryptedItems.push({
            id: item.updateId || undefined,
            name: item.name,
            folder: item.folder ? item.folder.trim() : null,
            encryptedBlob,
            domain,
            template: item.template || item.payload._template || "login",
            tags: [],
            favorite: false,
            hasTotp: !!item.payload.totpSecret,
          });
        } catch (encErr: any) {
          allFailedItems.push({
            name: item.name,
            reason: encErr?.message || "Failed to encrypt entry",
          });
        }
      }

      if (validEncryptedItems.length > 0) {
        try {
          const res = await api.importItems(validEncryptedItems);
          totalInserted += res.inserted || 0;
          totalUpdated += res.updated || 0;
          if (res.insertedIds && Array.isArray(res.insertedIds)) {
            allInsertedIds.push(...res.insertedIds);
          }
          if (res.failedItems && Array.isArray(res.failedItems)) {
            allFailedItems.push(...res.failedItems);
          }
        } catch (apiErr: any) {
          validEncryptedItems.forEach((it) => {
            allFailedItems.push({
              name: it.name,
              reason: apiErr?.message || "Server import batch failed",
            });
          });
        }
      }

      if (onProgress) {
        onProgress(Math.round(((i + chunk.length) / itemsToImport.length) * 100));
      }
    }

    // Refresh store items safely
    try {
      await get().fetchItems();
    } catch (refreshErr) {
      console.warn("[VaultStore] Failed to fetch items after import:", refreshErr);
    }

    return {
      inserted: totalInserted,
      updated: totalUpdated,
      insertedIds: allInsertedIds,
      failedItems: allFailedItems,
    };
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
        const rawUrls: string[] = [];
        if (p.url && typeof p.url === "string") rawUrls.push(p.url);
        if (item.domain && typeof item.domain === "string") rawUrls.push(item.domain);
        if (p.urls && Array.isArray(p.urls)) {
          p.urls.forEach((u: any) => {
            if (u && typeof u === "string") rawUrls.push(u);
          });
        }

        datasets.push({
          id: item.id,
          name: item.name,
          domain: item.domain || p.url || "",
          username: p.username || "",
          password: p.password || "",
          urls: Array.from(new Set(rawUrls)).filter(Boolean),
        });
      }
    } catch {}
  }
  await syncAutofillCredentials(datasets);
}


