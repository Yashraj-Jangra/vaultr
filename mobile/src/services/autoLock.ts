import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVaultStore } from "../store/vaultStore";
import { recordAutofillHeartbeat } from "./autofill";

const AUTO_LOCK_KEY = "vaultr_auto_lock_timeout";

let lastBackgroundTimestamp: number | null = null;
let subscription: any = null;

export function initAutoLockService(): void {
  if (subscription) return;

  subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
    if (nextAppState === "background" || nextAppState === "inactive") {
      lastBackgroundTimestamp = Date.now();
    } else if (nextAppState === "active") {
      recordAutofillHeartbeat();

      if (lastBackgroundTimestamp !== null) {
        const elapsedMs = Date.now() - lastBackgroundTimestamp;
        lastBackgroundTimestamp = null;

        try {
          const timeoutMinutesStr = await AsyncStorage.getItem(AUTO_LOCK_KEY);
          const timeoutMinutes = parseInt(timeoutMinutesStr || "5", 10);
          if (isNaN(timeoutMinutes) || timeoutMinutes < 0) return; // -1 means Never

          const timeoutMs = timeoutMinutes * 60 * 1000;
          if (elapsedMs >= timeoutMs) {
            console.log(`[AutoLock] App in background for ${Math.round(elapsedMs / 1000)}s >= ${timeoutMinutes}m timeout. Locking vault.`);
            useVaultStore.getState().lock();
          }
        } catch (err) {
          console.error("[AutoLock] Error checking timeout:", err);
        }
      }
    }
  });
}
