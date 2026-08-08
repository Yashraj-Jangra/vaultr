/**
 * Zustand Mobile Vault Store
 * Manages item state, master password derive key, biometric unlock, and offline sync.
 */

import { create } from "zustand";
import { VaultItem, VaultrApiClient, deriveKey, decrypt, encrypt } from "@vaultr/core";
import { cacheVaultItems, getCachedVaultItems, flushOfflineQueue } from "../services/sync";
import { unlockWithBiometrics, clearBiometricPassword } from "../services/biometrics";

interface VaultState {
  items: VaultItem[];
  cryptoKey: CryptoKey | null;
  masterPassword: string | null;
  isUnlocked: boolean;
  isLoading: boolean;
  serverUrl: string;
  searchQuery: string;

  setServerUrl: (url: string) => void;
  setSearchQuery: (query: string) => void;
  unlock: (masterPassword: string, serverUrl?: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  lock: () => void;
  fetchItems: () => Promise<void>;
  decryptItemBlob: (blob: string) => Promise<string>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  cryptoKey: null,
  masterPassword: null,
  isUnlocked: false,
  isLoading: false,
  serverUrl: "http://localhost:3000",
  searchQuery: "",

  setServerUrl: (serverUrl) => set({ serverUrl }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  unlock: async (masterPassword, customServerUrl) => {
    set({ isLoading: true });
    try {
      const serverUrl = customServerUrl || get().serverUrl;
      const key = await deriveKey(masterPassword, "vaultr_default_salt");
      const api = new VaultrApiClient({ baseUrl: serverUrl });

      let items: VaultItem[] = [];
      try {
        items = await api.getItems();
        await cacheVaultItems(items);
        await flushOfflineQueue(api);
      } catch {
        // Fallback to offline cache if network fails
        items = await getCachedVaultItems();
      }

      set({
        cryptoKey: key,
        masterPassword,
        items,
        isUnlocked: true,
        isLoading: false,
        serverUrl,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  unlockWithBiometrics: async () => {
    const savedPassword = await unlockWithBiometrics();
    if (!savedPassword) return false;
    await get().unlock(savedPassword);
    return true;
  },

  lock: () => {
    clearBiometricPassword();
    set({
      items: [],
      cryptoKey: null,
      masterPassword: null,
      isUnlocked: false,
    });
  },

  fetchItems: async () => {
    const { serverUrl } = get();
    const api = new VaultrApiClient({ baseUrl: serverUrl });
    try {
      const items = await api.getItems();
      await cacheVaultItems(items);
      set({ items });
    } catch (err) {
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
}));
