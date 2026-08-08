/**
 * Mobile Biometric Authentication Service (Fingerprint / Face Unlock / Passcode)
 * Integrates hardware-backed keychain via expo-secure-store.
 */

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SECURE_KEY = "vaultr_master_password";

/** Check if hardware biometric unlock is supported and enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/** Enroll current master password into hardware secure store protected by biometrics. */
export async function enrollBiometricPassword(masterPassword: string): Promise<boolean> {
  try {
    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) return false;

    await SecureStore.setItemAsync(SECURE_KEY, masterPassword, {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (err) {
    console.error("[Biometrics] Failed to enroll password:", err);
    return false;
  }
}

/** Prompt user for fingerprint / face authentication and retrieve master password. */
export async function unlockWithBiometrics(): Promise<string | null> {
  try {
    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) return null;

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Vaultr",
      fallbackLabel: "Use Master Password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (!authResult.success) return null;

    const savedPassword = await SecureStore.getItemAsync(SECURE_KEY, {
      requireAuthentication: true,
    });

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
  } catch {
    // ignore
  }
}
