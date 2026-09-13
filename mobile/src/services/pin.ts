/**
 * Mobile PIN Fast Re-Unlock Service
 * 
 * Provides local device PIN unlock with PBKDF2 + AES-256-GCM hardware keychain security.
 * Encrypts the master password in SecureStore with a PIN-derived key and enforces
 * strict rate-limiting (max 5 attempts before wiping the PIN credential).
 */

import * as SecureStore from "expo-secure-store";
import { deriveKey, encrypt, decrypt } from "@vaultr/core";
import { uint8ArrayToBase64 } from "../utils/base64";

const PIN_DATA_KEY = "vaultr_pin_blob";
const PIN_ENABLED_KEY = "vaultr_pin_enabled";
const PIN_FAILED_ATTEMPTS_KEY = "vaultr_pin_failed_attempts";
const MAX_FAILED_ATTEMPTS = 5;

export interface PinVerifyResult {
  success: boolean;
  password?: string;
  error?: string;
  remainingAttempts?: number;
  lockedOut?: boolean;
}

/** Check if PIN unlock is enabled and configured in SecureStore. */
export async function isPinSet(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(PIN_ENABLED_KEY);
    if (enabled !== "true") return false;
    const blob = await SecureStore.getItemAsync(PIN_DATA_KEY);
    return Boolean(blob);
  } catch {
    return false;
  }
}

/** Get configured PIN length (4 or 6, defaults to 4). */
export async function getPinLength(): Promise<number> {
  try {
    const blob = await SecureStore.getItemAsync(PIN_DATA_KEY);
    if (blob) {
      const data = JSON.parse(blob);
      if (data.pinLength === 6) return 6;
    }
    return 4;
  } catch {
    return 4;
  }
}

/** Get number of remaining incorrect PIN attempts before lockout. */
export async function getRemainingAttempts(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(PIN_FAILED_ATTEMPTS_KEY);
    const attempts = raw ? parseInt(raw, 10) : 0;
    return Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
  } catch {
    return MAX_FAILED_ATTEMPTS;
  }
}

/** Enroll a 4-to-6 digit PIN to encrypt the master password for fast re-unlock. */
export async function setupPin(pin: string, masterPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pin || pin.length < 4 || pin.length > 6) {
      return { success: false, error: "PIN must be 4 to 6 digits." };
    }
    if (!masterPassword) {
      return { success: false, error: "Master password is required to configure PIN unlock." };
    }

    // 1. Generate 16-byte random salt
    const saltBytes = new Uint8Array(16);
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(saltBytes);
    } else {
      for (let i = 0; i < 16; i++) {
        saltBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const salt = uint8ArrayToBase64(saltBytes);

    // 2. Derive AES-GCM key from PIN and salt
    const key = await deriveKey(pin, salt);

    // 3. Encrypt the master password with the PIN key
    const encryptedMasterPassword = await encrypt(key, masterPassword);

    // 4. Save to hardware SecureStore
    const payload = JSON.stringify({
      salt,
      encryptedMasterPassword,
      pinLength: pin.length,
      createdAt: new Date().toISOString(),
    });

    await SecureStore.setItemAsync(PIN_DATA_KEY, payload);
    await SecureStore.setItemAsync(PIN_ENABLED_KEY, "true");
    await SecureStore.setItemAsync(PIN_FAILED_ATTEMPTS_KEY, "0");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to configure PIN." };
  }
}

/** Verify entered PIN and decrypt stored master password with brute-force lockout guard. */
export async function verifyPinAndGetPassword(pin: string): Promise<PinVerifyResult> {
  try {
    const isConfigured = await isPinSet();
    if (!isConfigured) {
      return { success: false, error: "PIN unlock is not configured." };
    }

    const rawAttempts = await SecureStore.getItemAsync(PIN_FAILED_ATTEMPTS_KEY);
    let attempts = rawAttempts ? parseInt(rawAttempts, 10) : 0;

    // Check if already locked out
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await clearPin();
      return {
        success: false,
        lockedOut: true,
        remainingAttempts: 0,
        error: "Too many failed attempts. PIN unlock has been disabled. Please enter your Master Password.",
      };
    }

    const blobStr = await SecureStore.getItemAsync(PIN_DATA_KEY);
    if (!blobStr) {
      return { success: false, error: "No stored PIN credentials found." };
    }

    const { salt, encryptedMasterPassword } = JSON.parse(blobStr);

    try {
      const key = await deriveKey(pin, salt);
      const decryptedPassword = await decrypt(key, encryptedMasterPassword);

      if (!decryptedPassword) {
        throw new Error("Decryption returned empty string");
      }

      // Success: Reset failed attempts counter
      await SecureStore.setItemAsync(PIN_FAILED_ATTEMPTS_KEY, "0");
      return { success: true, password: decryptedPassword };
    } catch {
      // Failed PIN attempt
      attempts += 1;
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);

      if (remaining <= 0) {
        await clearPin();
        return {
          success: false,
          lockedOut: true,
          remainingAttempts: 0,
          error: "Too many failed attempts. PIN unlock has been disabled. Please enter your Master Password.",
        };
      }

      await SecureStore.setItemAsync(PIN_FAILED_ATTEMPTS_KEY, String(attempts));
      return {
        success: false,
        remainingAttempts: remaining,
        error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "PIN verification failed." };
  }
}

/** Clear all stored PIN credentials and reset lockout counter. */
export async function clearPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_DATA_KEY);
    await SecureStore.deleteItemAsync(PIN_ENABLED_KEY);
    await SecureStore.deleteItemAsync(PIN_FAILED_ATTEMPTS_KEY);
  } catch {}
}
