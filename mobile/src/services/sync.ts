/**
 * Mobile Offline Cache & Background Sync Engine
 * Manages encrypted blob caching in AsyncStorage and queues offline CRUD operations.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { VaultItem, VaultrApiClient, NewVaultItemPayload, BatchAction } from "@vaultr/core";

const CACHE_KEY = "vaultr_offline_items_cache_v1";
const QUEUE_KEY = "vaultr_offline_sync_queue_v1";

export interface PendingAction {
  id: string;
  type: "create" | "update" | "delete" | "batch";
  payload: any;
  createdAt: number;
}

/** Save encrypted vault items to offline local storage. */
export async function cacheVaultItems(items: VaultItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("[Offline Cache] Failed to cache items:", err);
  }
}

/** Load cached vault items when offline. */
export async function getCachedVaultItems(): Promise<VaultItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Push an operation to the pending offline queue. */
export async function queueOfflineAction(action: Omit<PendingAction, "id" | "createdAt">): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: PendingAction[] = raw ? JSON.parse(raw) : [];
    queue.push({
      ...action,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[Offline Queue] Failed to push action:", err);
  }
}

/** Process and flush all pending offline actions when online. */
export async function flushOfflineQueue(api: VaultrApiClient): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;

    const queue: PendingAction[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    let processedCount = 0;

    for (const item of queue) {
      try {
        if (item.type === "create") {
          await api.createItem(item.payload as NewVaultItemPayload);
        } else if (item.type === "update") {
          await api.updateItem(item.payload.id, item.payload.patch);
        } else if (item.type === "delete") {
          await api.deleteItem(item.payload.id);
        } else if (item.type === "batch") {
          await api.batchAction(item.payload.action as BatchAction, item.payload.ids, item.payload.payload);
        }
        processedCount++;
      } catch (err) {
        console.error("[Offline Sync] Failed to sync action:", item, err);
      }
    }

    // Clear queue after successful flush
    await AsyncStorage.removeItem(QUEUE_KEY);
    return processedCount;
  } catch (err) {
    console.error("[Offline Sync] Failed to flush queue:", err);
    return 0;
  }
}
