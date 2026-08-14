/**
 * Mobile Biometric Authentication Service (Fingerprint / Face Unlock / Passcode)
 * Integrates hardware-backed keychain via expo-secure-store and expo-local-authentication.
 */

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SECURE_KEY = "vaultr_master_password";
const ENABLED_KEY = "vaultr_biometric_enabled";

export interface BiometricAuthResult {
  success: boolean;
  password?: string;
  error?: string;
}

/** Check if hardware biometric unlock is supported. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    return hasHardware;
  } catch {
    return false;
  }
}

/** Check if biometric unlock is explicitly enabled by user in Settings. */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/** Confirm user biometric authentication & enroll master password into hardware secure store. */
export async function enrollBiometricPassword(masterPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!masterPassword) {
      return { success: false, error: "Vault must be unlocked with master password first." };
    }

    // 1. Prompt native OS biometric authentication to confirm user presence
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm Fingerprint / Face ID to enable Biometric Unlock",
      fallbackLabel: "Cancel",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error === "user_cancel" ? "cancel" : authResult.error || "Biometric verification failed.",
      };
    }

    // 2. Save master password to hardware SecureStore after successful verification
    await SecureStore.setItemAsync(SECURE_KEY, masterPassword);
    await SecureStore.setItemAsync(ENABLED_KEY, "true");
    return { success: true };
  } catch (err: any) {
    console.error("[Biometrics] Failed to enroll password:", err);
    return { success: false, error: err?.message || "Failed to register hardware biometrics." };
  }
}

/** Prompt user for fingerprint / face authentication and retrieve master password. */
export async function unlockWithBiometrics(): Promise<BiometricAuthResult> {
  try {
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      return { success: false, error: "Biometric unlock is not enabled in Security Settings." };
    }

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Vaultr",
      fallbackLabel: "Use Master Password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error === "user_cancel" ? "cancel" : authResult.error || "Biometric authentication failed.",
      };
    }

    const savedPassword = await SecureStore.getItemAsync(SECURE_KEY);
    if (!savedPassword) {
      return {
        success: false,
        error: "No stored master password found. Please re-enable biometrics in Settings.",
      };
    }

    return { success: true, password: savedPassword };
  } catch (err: any) {
    console.error("[Biometrics] Failed to unlock with biometrics:", err);
    return { success: false, error: err?.message || "Biometric hardware error." };
  }
}

/** Clear stored master password from hardware secure store on lock or sign out. */
export async function clearBiometricPassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
    await SecureStore.setItemAsync(ENABLED_KEY, "false");
  } catch {
    // ignore
  }
}

/** Update stored master password when master password is changed in settings. */
export async function updateBiometricPassword(newPassword: string): Promise<void> {
  try {
    const enabled = await isBiometricEnabled();
    if (enabled && newPassword) {
      await SecureStore.setItemAsync(SECURE_KEY, newPassword);
    }
  } catch (err) {
    console.warn("[Biometrics] Failed to update stored master password:", err);
  }
}

