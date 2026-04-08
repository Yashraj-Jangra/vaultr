"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCrypto, deriveKey } from "@/hooks/useCrypto";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Template = "login" | "card" | "address" | "profile" | "note";

export interface VaultItem {
  id: string;
  name: string;
  encryptedBlob: string;
  domain?: string;
  folder?: string;
  template?: Template;
  createdAt?: string;
  lastAccessedAt?: string;
  favorite?: boolean;
  hasTotp?: boolean;
}

export interface VaultContextValue {
  // State
  items: VaultItem[];
  cryptoKey: CryptoKey | null;
  isLocked: boolean;
  isLoading: boolean;
  unlockError: string;
  searchQuery: string;
  // Actions
  unlock: (masterPassword: string) => Promise<void>;
  lock: () => void;
  saveItem: (item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt"> & { encryptedBlob: string }) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  decryptItem: (blob: string) => Promise<string>;
  encryptData: (data: string) => Promise<string>;
  setSearchQuery: (q: string) => void;
  // Derived
  folders: string[];
  filteredItems: VaultItem[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFirebaseAuth();
  const { encrypt, decrypt } = useCrypto();

  const [items,       setItems]       = useState<VaultItem[]>([]);
  const [cryptoKey,   setCryptoKey]   = useState<CryptoKey | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [unlockError, setUnlockError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // When there's no user, mark loading as done immediately (no setState in effect)
  const hasUser = Boolean(user?.uid);

  // Subscribe to Firestore vault items
  useEffect(() => {
    if (!hasUser) return;
    const q = query(collection(db, "users", user!.uid, "vaultItems"));
    const unsub = onSnapshot(q, (snap) => {
      const list: VaultItem[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as VaultItem));
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [hasUser, user]);

  // If no user, loading is false
  const effectiveIsLoading = hasUser ? isLoading : false;

  const unlock = useCallback(async (masterPassword: string) => {
    if (!user?.uid) return;
    setUnlockError("");
    const key = await deriveKey(masterPassword, user.uid);
    if (items.length > 0) {
      try { await decrypt(key, items[0].encryptedBlob); }
      catch { setUnlockError("Wrong master password."); return; }
    }
    setCryptoKey(key);
  }, [user, items, decrypt]);

  const lock = useCallback(() => {
    setCryptoKey(null);
  }, []);

  const saveItem = useCallback(async (
    item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt">
  ) => {
    if (!user?.uid) return;
    const payload: Omit<VaultItem, "id"> = {
      ...item,
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db, "users", user.uid, "vaultItems"), payload);
  }, [user]);

  const deleteItem = useCallback(async (id: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, "users", user.uid, "vaultItems", id));
  }, [user]);

  const decryptItem = useCallback(async (blob: string): Promise<string> => {
    if (!cryptoKey) throw new Error("Vault is locked");
    return decrypt(cryptoKey, blob);
  }, [cryptoKey, decrypt]);

  const encryptData = useCallback(async (data: string): Promise<string> => {
    if (!cryptoKey) throw new Error("Vault is locked");
    return encrypt(cryptoKey, data);
  }, [cryptoKey, encrypt]);

  // Derived state
  const folders = Array.from(new Set(items.map((i) => i.folder).filter(Boolean) as string[])).sort();

  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.folder?.toLowerCase().includes(q) ||
          item.domain?.toLowerCase().includes(q)
        );
      })
    : items;

  return (
    <VaultContext.Provider value={{
      items,
      cryptoKey,
      isLocked: !cryptoKey,
      isLoading: effectiveIsLoading,
      unlockError,
      searchQuery,
      unlock,
      lock,
      saveItem,
      deleteItem,
      decryptItem,
      encryptData,
      setSearchQuery,
      folders,
      filteredItems,
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
