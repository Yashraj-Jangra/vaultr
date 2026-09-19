/**
 * Browser Extension PIN Fast Re-Unlock Service
 * 
 * Provides local device PIN unlock with PBKDF2 + AES-256-GCM WebCrypto security.
 * Encrypts the master password in chrome.storage.local with a PIN-derived key and enforces
 * strict rate-limiting (max 5 attempts before wiping the PIN credential).
 */

import { deriveKey, encrypt, decrypt } from "@vaultr/core";

export const PIN_DATA_KEY = "vaultr_pin_blob";
export const PIN_ENABLED_KEY = "vaultr_pin_enabled";
export const PIN_FAILED_ATTEMPTS_KEY = "vaultr_pin_failed_attempts";
export const MAX_FAILED_ATTEMPTS = 5;

export interface PinBlobData {
  salt: string;
  encryptedMasterPassword: string;
  pinLength: number;
  createdAt: string;
  lastPasswordChangedAt?: string | null;
}

export interface PinVerifyResult {
  success: boolean;
  password?: string;
  error?: string;
  remainingAttempts?: number;
  lockedOut?: boolean;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Check if PIN unlock is enabled and configured in chrome.storage.local. */
export async function isPinSet(): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return false;
  try {
    const res = await chrome.storage.local.get([PIN_ENABLED_KEY, PIN_DATA_KEY]);
    return Boolean(res[PIN_ENABLED_KEY] === true && res[PIN_DATA_KEY]);
  } catch {
    return false;
  }
}

/** Get configured PIN length (4 or 6, defaults to 4). */
export async function getPinLength(): Promise<number> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return 4;
  try {
    const res = await chrome.storage.local.get(PIN_DATA_KEY);
    if (res[PIN_DATA_KEY]) {
      const data = typeof res[PIN_DATA_KEY] === "string" ? JSON.parse(res[PIN_DATA_KEY]) : res[PIN_DATA_KEY];
      if (data.pinLength === 6) return 6;
    }
    return 4;
  } catch {
    return 4;
  }
}

/** Get number of remaining incorrect PIN attempts before lockout. */
export async function getRemainingAttempts(): Promise<number> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return MAX_FAILED_ATTEMPTS;
  try {
    const res = await chrome.storage.local.get(PIN_FAILED_ATTEMPTS_KEY);
    const attempts = res[PIN_FAILED_ATTEMPTS_KEY] ? parseInt(String(res[PIN_FAILED_ATTEMPTS_KEY]), 10) : 0;
    return Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
  } catch {
    return MAX_FAILED_ATTEMPTS;
  }
}

/** Get stored lastPasswordChangedAt if present. */
export async function getStoredPinPasswordChangedAt(): Promise<string | null> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
  try {
    const res = await chrome.storage.local.get(PIN_DATA_KEY);
    if (res[PIN_DATA_KEY]) {
      const data = typeof res[PIN_DATA_KEY] === "string" ? JSON.parse(res[PIN_DATA_KEY]) : res[PIN_DATA_KEY];
      return data.lastPasswordChangedAt || null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Enroll a 4 or 6 digit PIN to encrypt the master password for fast re-unlock. */
export async function setupPin(
  pin: string,
  masterPassword: string,
  serverUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pin || (pin.length !== 4 && pin.length !== 6)) {
      return { success: false, error: "PIN must be 4 or 6 digits." };
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

    // 4. Optionally fetch current lastPasswordChangedAt from server
    let lastPasswordChangedAt: string | null = null;
    if (serverUrl) {
      try {
        const cleanUrl = serverUrl.replace(/\/+$/, "");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${cleanUrl}/api/vault/profile`, {
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const profile = await res.json();
          lastPasswordChangedAt = profile?.lastPasswordChangedAt || null;
        }
      } catch {}
    }

    // 5. Persist payload
    const payload: PinBlobData = {
      salt,
      encryptedMasterPassword,
      pinLength: pin.length,
      createdAt: new Date().toISOString(),
      lastPasswordChangedAt,
    };

    await chrome.storage.local.set({
      [PIN_DATA_KEY]: JSON.stringify(payload),
      [PIN_ENABLED_KEY]: true,
      [PIN_FAILED_ATTEMPTS_KEY]: 0,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to configure PIN." };
  }
}

/** Check if remote password has changed since PIN was enrolled. */
export async function checkStalePin(serverUrl: string): Promise<boolean> {
  if (!serverUrl) return false;
  try {
    const isConfigured = await isPinSet();
    if (!isConfigured) return false;

    const storedChangedAt = await getStoredPinPasswordChangedAt();
    const cleanUrl = serverUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const profRes = await fetch(`${cleanUrl}/api/vault/profile`, {
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (profRes.ok) {
      const profData = await profRes.json();
      const serverChangedAt = profData?.lastPasswordChangedAt || null;
      if (serverChangedAt) {
        if (!storedChangedAt) {
          await clearPin();
          return true;
        }
        const serverTime = new Date(serverChangedAt).getTime();
        const storedTime = new Date(storedChangedAt).getTime();
        if (serverTime > storedTime) {
          await clearPin();
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Verify entered PIN and decrypt stored master password with brute-force lockout guard. */
export async function verifyPinAndGetPassword(pin: string): Promise<PinVerifyResult> {
  try {
    const isConfigured = await isPinSet();
    if (!isConfigured) {
      return { success: false, error: "PIN unlock is not configured." };
    }

    const res = await chrome.storage.local.get([PIN_FAILED_ATTEMPTS_KEY, PIN_DATA_KEY]);
    let attempts = res[PIN_FAILED_ATTEMPTS_KEY] ? parseInt(String(res[PIN_FAILED_ATTEMPTS_KEY]), 10) : 0;

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

    const rawBlob = res[PIN_DATA_KEY];
    if (!rawBlob) {
      return { success: false, error: "No stored PIN credentials found." };
    }

    const { salt, encryptedMasterPassword } = typeof rawBlob === "string" ? JSON.parse(rawBlob) : rawBlob;

    try {
      const key = await deriveKey(pin, salt);
      const decryptedPassword = await decrypt(key, encryptedMasterPassword);

      if (!decryptedPassword) {
        throw new Error("Decryption returned empty string");
      }

      // Success: Reset failed attempts counter
      await chrome.storage.local.set({ [PIN_FAILED_ATTEMPTS_KEY]: 0 });
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

      await chrome.storage.local.set({ [PIN_FAILED_ATTEMPTS_KEY]: attempts });
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
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  try {
    await chrome.storage.local.remove([PIN_DATA_KEY, PIN_ENABLED_KEY, PIN_FAILED_ATTEMPTS_KEY]);
  } catch {}
}
