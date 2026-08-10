/**
 * Android System Autofill Service Bridge
 * Manages autofill credential indexing and Android system integration.
 */

import { NativeModules, Platform } from "react-native";

const { VaultrAutofillModule } = NativeModules;

export interface AutofillDataset {
  id: string;
  name: string;
  domain?: string;
  username?: string;
  password?: string;
}

/** Check if Vaultr is registered as the default Android Autofill Provider. */
export async function checkAutofillStatus(): Promise<boolean> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return false;
  try {
    return await VaultrAutofillModule.checkStatus();
  } catch {
    return false;
  }
}

/** Open Android Settings screen to enable Vaultr as system Autofill Provider. */
export function openAutofillSettings(): void {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    VaultrAutofillModule.openSettings();
  } catch {}
}

/** Sync decrypted credentials with Android Autofill Service native store. */
export async function syncAutofillCredentials(logins: AutofillDataset[]): Promise<void> {
  if (Platform.OS !== "android" || !VaultrAutofillModule) return;
  try {
    const jsonString = JSON.stringify(logins);
    await VaultrAutofillModule.syncCredentials(jsonString);
    console.log(`[Android Autofill] Indexed ${logins.length} credentials into native store.`);
  } catch (err) {
    console.error("[Android Autofill] Failed to sync credentials to native store:", err);
  }
}
