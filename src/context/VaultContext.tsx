"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, setDoc, increment, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCrypto, deriveKey } from "@/hooks/useCrypto";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
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
  // State
  items: VaultItem[];
  cryptoKey: CryptoKey | null;
  isLocked: boolean;
  isLoading: boolean;
  unlockError: string;
  searchQuery: string;
  /** Auto-lock timeout in minutes. 0 = disabled. Default: 15. */
  autoLockMinutes: number;
  // Actions
  unlock: (masterPassword: string) => Promise<string | void>;
  lock: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  saveItem: (item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt"> & { encryptedBlob: string }) => Promise<void>;
  updateItem: (id: string, payload: Partial<VaultItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  hardDeleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string, currentStatus: boolean) => Promise<void>;
  decryptItem: (blob: string) => Promise<string>;
  encryptData: (data: string) => Promise<string>;
  setSearchQuery: (q: string) => void;
  // UI State
  isNewEntryOpen: boolean;
  setIsNewEntryOpen: (val: boolean) => void;
  // Derived
  folders: string[];
  filteredItems: VaultItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default auto-lock: 15 minutes of inactivity */
const DEFAULT_AUTO_LOCK_MINUTES = 15;

/** localStorage key for per-user auto-lock preference */
const AUTO_LOCK_PREF_KEY = "vaultr_autolock_min";

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
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(DEFAULT_AUTO_LOCK_MINUTES);

  // Tracks whether we've already attempted to restore the session on mount
  const sessionRestored = useRef(false);

  // ── Load auto-lock preference from localStorage (per-user)
  useEffect(() => {
    if (!user?.uid) return;
    try {
      const stored = localStorage.getItem(`${AUTO_LOCK_PREF_KEY}_${user.uid}`);
      if (stored !== null) {
        setAutoLockMinutesState(Number(stored));
      }
    } catch {
      // ignore
    }
  }, [user?.uid]);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    setAutoLockMinutesState(minutes);
    if (user?.uid) {
      try {
        localStorage.setItem(`${AUTO_LOCK_PREF_KEY}_${user.uid}`, String(minutes));
      } catch {
        // ignore
      }
    }
  }, [user?.uid]);

  // ── Subscribe to Firestore vault items
  const hasUser = Boolean(user?.uid);

  useEffect(() => {
    if (!hasUser) return;
    const q = query(collection(db, "users", user!.uid, "vaultItems"));
    const unsub = onSnapshot(q, (snap) => {
      const list: VaultItem[] = [];
      const now = Date.now();
      
      snap.forEach((d) => {
        const data = d.data() as VaultItem;
        // Passive trash sweep: hard delete if deletedAt > 30 days
        if (data.deletedAt) {
          const deletedTime = new Date(data.deletedAt).getTime();
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          if (now - deletedTime > thirtyDaysMs) {
            // Delete passively, won't await to avoid UI blocking
            deleteDoc(doc(db, "users", user!.uid, "vaultItems", d.id));
            setDoc(doc(db, "config", "stats"), { totalEntries: increment(-1) }, { merge: true }).catch(()=>{});
            return; // Skip adding to state
          }
        }
        list.push({ ...data, id: d.id });
      });
      
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [hasUser, user]);

  // If no user, loading is false
  const effectiveIsLoading = hasUser ? isLoading : false;

  // ── Session restore: on mount (or when user becomes available),
  //    check sessionStorage and silently re-derive key if session is still valid
  useEffect(() => {
    if (!user?.uid || sessionRestored.current) return;
    sessionRestored.current = true;

    const session = loadVaultSession(user.uid, autoLockMinutes);
    if (!session) return;

    // Silently re-derive the key
    (async () => {
      try {
        const key = await deriveKey(session.masterPassword, user.uid);
        setCryptoKey(key);
      } catch {
        // Session data corrupted — clear it
        clearVaultSession(user.uid!);
      }
    })();
    // We intentionally do NOT include autoLockMinutes here — it would re-run
    // needlessly. The session is only restored once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ── Auto-lock idle timer
  const lockTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (lockTimerRef.current)  clearTimeout(lockTimerRef.current);
    if (warnTimerRef.current)  clearTimeout(warnTimerRef.current);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!cryptoKey || !user?.uid) return;
    if (autoLockMinutes === 0) return;

    clearTimers();

    // Refresh the session timestamp so a restore after idle doesn't succeed
    refreshVaultSession(user.uid);

    const lockMs = autoLockMinutes * 60 * 1000;
    lockTimerRef.current = setTimeout(() => {
      setCryptoKey(null);
      if (user?.uid) clearVaultSession(user.uid);
    }, lockMs);
  }, [cryptoKey, user?.uid, autoLockMinutes, clearTimers]);

  // Start/reset the idle timer whenever the vault is unlocked or the timeout changes
  useEffect(() => {
    if (!cryptoKey || autoLockMinutes === 0) {
      clearTimers();
      return;
    }

    resetIdleTimer();

    const ACTIVITY_EVENTS = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
    ] as const;
    const handleActivity = () => resetIdleTimer();

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity)
      );
      clearTimers();
    };
  }, [cryptoKey, autoLockMinutes, resetIdleTimer, clearTimers]);

  // ── Clear session when user signs out
  useEffect(() => {
    if (!user?.uid) {
      setCryptoKey(null);
      sessionRestored.current = false;
    }
  }, [user?.uid]);

  // ── Vault actions

  const unlock = useCallback(async (masterPassword: string): Promise<string | void> => {
    if (!user?.uid) return;
    setUnlockError("");

    const key = await deriveKey(masterPassword, user.uid);

    // Validate against an existing item if possible
    if (items.length > 0) {
      try {
        await decrypt(key, items[0].encryptedBlob);
      } catch {
        const msg = "Wrong master password.";
        setUnlockError(msg);
        return msg; // return error so caller can act on it directly
      }
    }

    setCryptoKey(key);
    saveVaultSession(user.uid, masterPassword);
  }, [user, items, decrypt]);

  const lock = useCallback(() => {
    setCryptoKey(null);
    if (user?.uid) clearVaultSession(user.uid);
    clearTimers();
  }, [user?.uid, clearTimers]);

  const saveItem = useCallback(async (
    item: Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt">
  ) => {
    if (!user?.uid) return;
    const payload: Omit<VaultItem, "id"> = {
      ...item,
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db, "users", user.uid, "vaultItems"), payload);
    
    // Increment global analytics tally
    try {
      await setDoc(doc(db, "config", "stats"), { totalEntries: increment(1) }, { merge: true });
    } catch (err) {
      console.warn("Failed to increment stats", err);
    }
  }, [user]);

  const updateItem = useCallback(async (id: string, payload: Partial<VaultItem>) => {
    if (!user?.uid) return;
    const finalPayload = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, "users", user.uid, "vaultItems", id), finalPayload, { merge: true });
  }, [user]);

  const deleteItem = useCallback(async (id: string) => {
    if (!user?.uid) return;
    // Soft Delete
    await setDoc(doc(db, "users", user.uid, "vaultItems", id), { deletedAt: new Date().toISOString() }, { merge: true });
  }, [user]);
  
  const hardDeleteItem = useCallback(async (id: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, "users", user.uid, "vaultItems", id));
    
    // Decrement global analytics tally
    try {
      await setDoc(doc(db, "config", "stats"), { totalEntries: increment(-1) }, { merge: true });
    } catch (err) {
      console.warn("Failed to decrement stats", err);
    }
  }, [user]);

  const restoreItem = useCallback(async (id: string) => {
    if (!user?.uid) return;
    await setDoc(doc(db, "users", user.uid, "vaultItems", id), { deletedAt: deleteField() }, { merge: true });
  }, [user]);

  const toggleFavorite = useCallback(async (id: string, favorite: boolean) => {
    if (!user?.uid) return;
    await setDoc(doc(db, "users", user.uid, "vaultItems", id), { favorite }, { merge: true });
  }, [user]);

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
    new Set(items.map((i) => i.folder).filter(Boolean) as string[])
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
