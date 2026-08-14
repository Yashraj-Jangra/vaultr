/**
 * Mobile Offline Cache Service
 * Provides secure user-scoped storage for encrypted vault items in AsyncStorage.
 * In this architecture, writes require active internet connection, while the local cache
 * provides safe, read-only decrypted viewing when offline.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { VaultItem } from "@vaultr/core";

function getCacheKey(userId?: string | null): string {
  const safeId = userId && userId.trim() ? userId.trim() : "default";
  return `vaultr_offline_items_cache_v2_${safeId}`;
}

/** Save encrypted vault items to user-scoped offline local storage. */
export async function cacheVaultItems(items: VaultItem[], userId?: string | null): Promise<void> {
  try {
    const key = getCacheKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error("[Offline Cache] Failed to cache items:", err);
  }
}

/** Load cached encrypted vault items when offline. */
export async function getCachedVaultItems(userId?: string | null): Promise<VaultItem[]> {
  try {
    const key = getCacheKey(userId);
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("[Offline Cache] Failed to load cached items:", err);
    return [];
  }
}

/** Clear cached items on account logout. */
export async function clearCachedVaultItems(userId?: string | null): Promise<void> {
  try {
    const key = getCacheKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error("[Offline Cache] Failed to clear cached items:", err);
  }
}
