"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useCrypto, deriveKey } from "@/hooks/useCrypto";
import { useAuth } from "@/hooks/useAuth";
import {
  saveVaultSession,
  loadVaultSession,
  clearVaultSession,
  refreshVaultSession,
} from "@/hooks/useVaultSession";

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
  updatedAt?: string;
  lastAccessedAt?: string;
  favorite?: boolean;
  hasTotp?: boolean;
  tags?: string[];
  deletedAt?: string | null;
}

export interface VaultContextValue {
  items: VaultItem[];
  cryptoKey: CryptoKey | null;
  isLocked: boolean;
  isLoading: boolean;
  unlockError: string;
  searchQuery: string;
  /** Auto-lock timeout in minutes. 0 = disabled. Default: 15. */
  autoLockMinutes: number;
  unlock: (masterPassword: string) => Promise<string | void>;
  lock: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  saveItem: (item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt"> & { encryptedBlob: string }) => Promise<any>;
  updateItem: (id: string, payload: Partial<VaultItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  hardDeleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string, currentStatus: boolean) => Promise<void>;
  decryptItem: (blob: string) => Promise<string>;
  encryptData: (data: string) => Promise<string>;
  setSearchQuery: (q: string) => void;
  isNewEntryOpen: boolean;
  setIsNewEntryOpen: (val: boolean) => void;
  folders: string[];
  filteredItems: VaultItem[];
  /** Bulk action on multiple items via a single API call. Returns number of updated items. */
  batchAction: (action: "trash" | "restore" | "favorite" | "unfavorite" | "move" | "purge", ids: string[], payload?: string) => Promise<number>;
  /** Permanently delete all items currently in trash. */
  emptyTrash: () => Promise<number>;
  /** Add a folder (and its ancestors) to custom persisted folders list. */
  addCustomFolder: (folderPath: string) => void;
  /** Rename a folder across all items that have it. */
  renameFolder: (from: string, to: string) => Promise<void>;
  /** Delete a folder — move items to uncategorized (default) or trash. */
  deleteFolder: (name: string, disposition?: "uncategorize" | "trash") => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AUTO_LOCK_MINUTES = 15;
const AUTO_LOCK_PREF_KEY = "vaultr_autolock_min";

// ─── DB row → VaultItem normalizer ────────────────────────────────────────────
// Postgres returns snake_case; our interface uses camelCase

function rowToItem(row: Record<string, unknown>): VaultItem {
  const createdAt = row.created_at ?? row.createdAt;
  const updatedAt = row.updated_at ?? row.updatedAt;
  const lastAccessedAt = row.last_accessed_at ?? row.lastAccessedAt;
  const deletedAt = row.deleted_at ?? row.deletedAt;

  return {
    id:             row.id as string,
    name:           row.name as string,
    encryptedBlob:  (row.encrypted_blob ?? row.encryptedBlob) as string,
    domain:         (row.domain ?? undefined) as string | undefined,
    folder:         (row.folder ?? undefined) as string | undefined,
    template:       (row.template ?? "login") as Template,
    createdAt:      createdAt ? new Date(createdAt as string | Date).toISOString() : undefined,
    updatedAt:      updatedAt ? new Date(updatedAt as string | Date).toISOString() : undefined,
    lastAccessedAt: lastAccessedAt ? new Date(lastAccessedAt as string | Date).toISOString() : undefined,
    favorite:       (row.favorite ?? false) as boolean,
    hasTotp:        (row.has_totp ?? row.hasTotp ?? false) as boolean,
    tags:           (row.tags ?? []) as string[],
    deletedAt:      deletedAt ? new Date(deletedAt as string | Date).toISOString() : null,
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { encrypt, decrypt } = useCrypto();

  const [items,          setItems]          = useState<VaultItem[]>([]);
  const [cryptoKey,      setCryptoKey]      = useState<CryptoKey | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isRestoring,    setIsRestoring]    = useState(true);
  const [unlockError,    setUnlockError]    = useState("");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(DEFAULT_AUTO_LOCK_MINUTES);

  const sessionRestored = useRef(false);
  const sseRef = useRef<EventSource | null>(null);

  // ── Load auto-lock preference from localStorage (per-user)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`${AUTO_LOCK_PREF_KEY}_${user.id}`);
      if (stored !== null) setAutoLockMinutesState(Number(stored));
    } catch { /* ignore */ }
  }, [user?.id]);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    setAutoLockMinutesState(minutes);
    if (user?.id) {
      try { localStorage.setItem(`${AUTO_LOCK_PREF_KEY}_${user.id}`, String(minutes)); }
      catch { /* ignore */ }
    }
  }, [user?.id]);

  const lastFetchTimeRef = useRef(0);
  const fetchingRef = useRef(false);

  // ── Fetch vault items from REST API
  const fetchItems = useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (fetchingRef.current || now - lastFetchTimeRef.current < 1000) return;
    fetchingRef.current = true;
    lastFetchTimeRef.current = now;
    try {
      const data = await apiFetch("/api/vault/items");
      const list: VaultItem[] = (data.items ?? [])
        .map(rowToItem)
        .sort((a: VaultItem, b: VaultItem) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      setItems(list);
    } catch (err) {
      console.error("[VaultContext] fetchItems error", err);
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  }, [user?.id]);

  // ── Subscribe to SSE for real-time updates
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchItems();

    // SSE stream
    const es = new EventSource("/api/vault/stream", { withCredentials: true });
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "vault_changed") fetchItems();
      } catch { /* ignore malformed messages */ }
    };

    es.onerror = () => {
      // SSE reconnects automatically; no action needed
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [user?.id, fetchItems]);

  // ── Session restore
  useEffect(() => {
    if (!user?.id) {
      setIsRestoring(false);
      return;
    }
    if (sessionRestored.current) return;
    sessionRestored.current = true;

    const session = loadVaultSession(user.id, autoLockMinutes);
    if (!session) {
      setIsRestoring(false);
      return;
    }

    (async () => {
      try {
        const key = await deriveKey(session.masterPassword, user.id);
        setCryptoKey(key);
      } catch {
        clearVaultSession(user.id!);
      } finally {
        setIsRestoring(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Auto-lock idle timer
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!cryptoKey || !user?.id) return;
    if (autoLockMinutes === 0) return;
    clearTimers();
    refreshVaultSession(user.id);
    const lockMs = autoLockMinutes * 60 * 1000;
    lockTimerRef.current = setTimeout(() => {
      setCryptoKey(null);
      if (user?.id) clearVaultSession(user.id);
      setIsNewEntryOpen(false);
    }, lockMs);
  }, [cryptoKey, user?.id, autoLockMinutes, clearTimers]);

  useEffect(() => {
    if (!cryptoKey || autoLockMinutes === 0) { clearTimers(); return; }
    resetIdleTimer();
    const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    const handleActivity = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [cryptoKey, autoLockMinutes, resetIdleTimer, clearTimers]);

  // ── Clear session when user signs out
  useEffect(() => {
    if (!user?.id) {
      setCryptoKey(null);
      sessionRestored.current = false;
    }
  }, [user?.id]);

  // ── Vault actions

  const unlock = useCallback(async (masterPassword: string): Promise<string | void> => {
    if (!user?.id) return;
    setUnlockError("");
    const key = await deriveKey(masterPassword, user.id);
    if (items.length > 0) {
      try { await decrypt(key, items[0].encryptedBlob); }
      catch {
        const msg = "Wrong master password.";
        setUnlockError(msg);
        return msg;
      }
    }
    setCryptoKey(key);
    saveVaultSession(user.id, masterPassword);
  }, [user, items, decrypt]);

  const lock = useCallback(() => {
    setCryptoKey(null);
    if (user?.id) clearVaultSession(user.id);
    clearTimers();
    setIsNewEntryOpen(false);
  }, [user?.id, clearTimers]);

  const saveItem = useCallback(async (
    item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt">
  ) => {
    if (!user?.id) return;
    const res = await apiFetch("/api/vault/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    fetchItems();
    return res.item;
  }, [user, fetchItems]);

  const updateItem = useCallback(async (id: string, payload: Partial<VaultItem>) => {
    if (!user?.id) return;
    await apiFetch(`/api/vault/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }),
    });
    fetchItems();
  }, [user, fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    if (!user?.id) return;
    // Soft delete — set deletedAt
    await apiFetch(`/api/vault/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    });
    fetchItems();
  }, [user, fetchItems]);

  const hardDeleteItem = useCallback(async (id: string) => {
    if (!user?.id) return;
    await apiFetch(`/api/vault/items/${id}`, { method: "DELETE" });
    fetchItems();
  }, [user, fetchItems]);

  const restoreItem = useCallback(async (id: string) => {
    if (!user?.id) return;
    await apiFetch(`/api/vault/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: null }),
    });
    fetchItems();
  }, [user, fetchItems]);

  const toggleFavorite = useCallback(async (id: string, favorite: boolean) => {
    if (!user?.id) return;
    await apiFetch(`/api/vault/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    });
    fetchItems();
  }, [user, fetchItems]);

  const batchAction = useCallback(async (
    action: "trash" | "restore" | "favorite" | "unfavorite" | "move" | "purge",
    ids: string[],
    payload?: string
  ): Promise<number> => {
    if (!user?.id || ids.length === 0) return 0;
    const res = await apiFetch("/api/vault/items/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, payload }),
    });
    fetchItems();
    return res.updated ?? 0;
  }, [user, fetchItems]);

  const emptyTrash = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;
    const trashItems = items.filter(i => !!i.deletedAt);
    if (trashItems.length === 0) return 0;
    const ids = trashItems.map(i => i.id);
    const count = await batchAction("purge", ids);
    return count;
  }, [user, items, batchAction]);

  // ── Custom / empty folders state (persisted per user)
  const CUSTOM_FOLDERS_KEY = user?.id ? `vaultr_custom_folders_${user.id}` : null;
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    if (!user?.id) return [];
    try {
      const stored = localStorage.getItem(`vaultr_custom_folders_${user.id}`);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  });

  // Keep customFolders synced when user changes
  useEffect(() => {
    if (!user?.id) {
      setCustomFolders([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`vaultr_custom_folders_${user.id}`);
      if (stored) setCustomFolders(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [user?.id]);

  const addCustomFolder = useCallback((folderPath: string) => {
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    setCustomFolders(prev => {
      const set = new Set(prev);
      const segs = trimmed.split("/").filter(Boolean);
      for (let i = 1; i <= segs.length; i++) {
        set.add(segs.slice(0, i).join("/"));
      }
      const next = Array.from(set).sort();
      if (CUSTOM_FOLDERS_KEY) {
        try { localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(next)); }
        catch { /* ignore */ }
      }
      return next;
    });
  }, [CUSTOM_FOLDERS_KEY]);

  const renameFolder = useCallback(async (from: string, to: string) => {
    if (!user?.id) return;
    await apiFetch("/api/vault/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });

    // Update customFolders for exact match and prefix matches
    setCustomFolders(prev => {
      const fromPrefix = `${from}/`;
      const next = prev.map(f => {
        if (f === from) return to;
        if (f.startsWith(fromPrefix)) return `${to}/${f.slice(fromPrefix.length)}`;
        return f;
      });
      const unique = Array.from(new Set(next)).sort();
      if (CUSTOM_FOLDERS_KEY) {
        try { localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(unique)); }
        catch { /* ignore */ }
      }
      return unique;
    });

    fetchItems();
  }, [user, fetchItems, CUSTOM_FOLDERS_KEY]);

  const deleteFolder = useCallback(async (name: string, disposition: "uncategorize" | "trash" = "uncategorize") => {
    if (!user?.id) return;
    await apiFetch("/api/vault/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, disposition }),
    });

    // Remove folder and all its subfolders from customFolders
    setCustomFolders(prev => {
      const namePrefix = `${name}/`;
      const next = prev.filter(f => f !== name && !f.startsWith(namePrefix));
      if (CUSTOM_FOLDERS_KEY) {
        try { localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(next)); }
        catch { /* ignore */ }
      }
      return next;
    });

    fetchItems();
  }, [user, fetchItems, CUSTOM_FOLDERS_KEY]);

  const decryptItem = useCallback(async (blob: string): Promise<string> => {
    if (!cryptoKey) throw new Error("Vault is locked");
    return decrypt(cryptoKey, blob);
  }, [cryptoKey, decrypt]);

  const encryptData = useCallback(async (data: string): Promise<string> => {
    if (!cryptoKey) throw new Error("Vault is locked");
    return encrypt(cryptoKey, data);
  }, [cryptoKey, encrypt]);

  // ── Derived state
  const folders = Array.from(
    new Set([
      ...(items.map((i) => i.folder).filter(Boolean) as string[]),
      ...customFolders,
    ])
  ).sort();

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

  const effectiveIsLoading = Boolean(user?.id) ? (isLoading || isRestoring) : false;

  return (
    <VaultContext.Provider value={{
      items,
      cryptoKey,
      isLocked: !cryptoKey,
      isLoading: effectiveIsLoading,
      unlockError,
      searchQuery,
      autoLockMinutes,
      unlock,
      lock,
      setAutoLockMinutes,
      saveItem,
      updateItem,
      deleteItem,
      hardDeleteItem,
      restoreItem,
      toggleFavorite,
      batchAction,
      emptyTrash,
      addCustomFolder,
      renameFolder,
      deleteFolder,
      decryptItem,
      encryptData,
      setSearchQuery,
      isNewEntryOpen,
      setIsNewEntryOpen,
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
