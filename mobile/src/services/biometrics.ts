/**
 * Mobile Biometric Authentication Service (Fingerprint / Face Unlock / Passcode)
 * Integrates hardware-backed keychain via expo-secure-store and expo-local-authentication.
 */

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SECURE_KEY = "vaultr_master_password";
const ENABLED_KEY = "vaultr_biometric_enabled";

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

/** Enroll current master password into hardware secure store protected by biometrics. */
export async function enrollBiometricPassword(masterPassword: string): Promise<boolean> {
  try {
    if (!masterPassword) return false;
    await SecureStore.setItemAsync(SECURE_KEY, masterPassword);
    await SecureStore.setItemAsync(ENABLED_KEY, "true");
    return true;
  } catch (err) {
    console.error("[Biometrics] Failed to enroll password:", err);
    return false;
  }
}

/** Prompt user for fingerprint / face authentication and retrieve master password. */
export async function unlockWithBiometrics(): Promise<string | null> {
  try {
    const enabled = await isBiometricEnabled();
    if (!enabled) return null;

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Vaultr",
      fallbackLabel: "Use Master Password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (!authResult.success) return null;

    const savedPassword = await SecureStore.getItemAsync(SECURE_KEY);
    return savedPassword;
  } catch (err) {
    console.error("[Biometrics] Failed to unlock with biometrics:", err);
    return null;
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
