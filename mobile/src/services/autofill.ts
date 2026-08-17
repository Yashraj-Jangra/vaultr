/**
 * Android System Autofill Service Bridge
 * Manages autofill credential indexing, Android system integration, and accessibility fallback.
 */

import { NativeModules, Platform } from "react-native";

const { VaultrAutofillModule } = NativeModules;

export interface AutofillDataset {
  id: string;
  name: string;
  domain?: string;
  username?: string;
  password?: string;
  urls?: string[];
}

export interface AutofillStatus {
  isAutofillSupported: boolean;
  isAutofillEnabled: boolean;
  isAccessibilityEnabled: boolean;
  credentialCount: number;
}

/** Check comprehensive autofill and accessibility status on Android. */
export async function getAutofillStatus(): Promise<AutofillStatus> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) {
    return {
      isAutofillSupported: false,
      isAutofillEnabled: false,
      isAccessibilityEnabled: false,
      credentialCount: 0,
    };
  }
  try {
    const res = await VaultrAutofillModule.checkStatus();
    return {
      isAutofillSupported: !!res.isAutofillSupported,
      isAutofillEnabled: !!res.isAutofillEnabled,
      isAccessibilityEnabled: !!res.isAccessibilityEnabled,
      credentialCount: res.credentialCount || 0,
    };
  } catch {
    return {
      isAutofillSupported: false,
      isAutofillEnabled: false,
      isAccessibilityEnabled: false,
      credentialCount: 0,
    };
  }
}

/** Legacy boolean status checker for backwards compatibility. */
export async function checkAutofillStatus(): Promise<boolean> {
  const status = await getAutofillStatus();
  return status.isAutofillEnabled;
}

/** Open Android Settings screen to enable Vaultr as system Autofill Provider. */
export function openAutofillSettings(): void {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    VaultrAutofillModule.openSettings();
  } catch {}
}

/** Open Android Accessibility settings screen. */
export function openAccessibilitySettings(): void {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    VaultrAutofillModule.openAccessibilitySettings();
  } catch {}
}

/** Sync decrypted credentials with Android Autofill Service native store. */
export async function syncAutofillCredentials(logins: AutofillDataset[], timeoutMinutes: number = 5): Promise<void> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    const jsonString = JSON.stringify(logins);
    const count = await VaultrAutofillModule.syncCredentials(jsonString, timeoutMinutes);
    console.log(`[Android Autofill] Indexed ${count} credentials into native store (timeout: ${timeoutMinutes}m).`);
  } catch (err) {
    console.error("[Android Autofill] Failed to sync credentials to native store:", err);
  }
}

/** Record user heartbeat activity to keep native autofill cache fresh while active. */
export async function recordAutofillHeartbeat(): Promise<void> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    await VaultrAutofillModule.recordHeartbeat();
  } catch {}
}

/** Clear all cached credentials from native store on vault lock or logout. */
export async function clearAutofillCredentials(): Promise<void> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    await VaultrAutofillModule.clearCredentials();
    console.log("[Android Autofill] Cleared credentials from native store.");
  } catch (err) {
    console.error("[Android Autofill] Failed to clear credentials:", err);
  }
}

/** Test query matcher for diagnostics tool. */
export async function testAutofillMatch(query: string): Promise<Array<{ id: string; name: string; domain?: string; username: string }>> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return [];
  try {
    return await VaultrAutofillModule.testMatch(query);
  } catch {
    return [];
  }
}

/** Check if the app was launched specifically to authenticate an Android autofill request. */
export async function isAutofillUnlockPending(): Promise<boolean> {
  if (Platform.OS !== "android" || !VaultrAutofillModule?.isAutofillUnlockPending) return false;
  try {
    return await VaultrAutofillModule.isAutofillUnlockPending();
  } catch {
    return false;
  }
}

/** Finish the autofill unlock sequence, return to the autofill search sheet, and minimize Vaultr. */
export async function finishAutofillUnlock(): Promise<void> {
  if (Platform.OS !== "android" || !VaultrAutofillModule?.finishAutofillUnlock) return;
  try {
    await VaultrAutofillModule.finishAutofillUnlock();
  } catch (err) {
    console.warn("[Autofill] Failed to finish autofill unlock:", err);
  }
}

