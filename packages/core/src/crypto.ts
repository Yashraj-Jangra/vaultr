/**
 * Environment-agnostic WebCrypto utilities.
 * Works in browsers, Chrome extension background service workers, Node.js (19+), and React Native / Hermes (via 0-dependency @noble fallback).
 */

import { pbkdf2, pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { gcm } from "@noble/ciphers/aes.js";

function getNativeSubtle(): SubtleCrypto | null {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  return null;
}

function getRandomValues(len: number): Uint8Array {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(len));
  }
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(new Uint8Array(len));
  }
  throw new Error("CSPRNG unavailable: crypto.getRandomValues is required");
}
let customPbkdf2: ((password: string, salt: string) => Promise<Uint8Array>) | null = null;

export const setCustomPbkdf2 = (fn: typeof customPbkdf2) => {
  customPbkdf2 = fn;
};

/**
 * Non-blocking PBKDF2 HMAC-SHA256 key derivation with periodic microtask yielding.
 * Yields every `yieldInterval` iterations so the React Native UI thread (120 FPS) never freezes.
 */
export async function pbkdf2AsyncYielding(
  password: string | Uint8Array,
  salt: string | Uint8Array,
  opts: { c: number; dkLen: number; yieldInterval?: number }
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passBytes = typeof password === "string" ? enc.encode(password) : password;
  const saltBytes = typeof salt === "string" ? enc.encode(salt) : salt;
  const { c, dkLen, yieldInterval = 2000 } = opts;

  const hLen = 32;
  const DK = new Uint8Array(dkLen);
  const blocks = Math.ceil(dkLen / hLen);

  for (let i = 1; i <= blocks; i++) {
    const saltWithI = new Uint8Array(saltBytes.length + 4);
    saltWithI.set(saltBytes);
    const view = new DataView(saltWithI.buffer);
    view.setUint32(saltBytes.length, i, false);

    let U = hmac(sha256, passBytes, saltWithI);
    const T = new Uint8Array(U);

    for (let u = 2; u <= c; u++) {
      U = hmac(sha256, passBytes, U);
      for (let k = 0; k < hLen; k++) {
        T[k] ^= U[k];
      }
      if (u % yieldInterval === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const offset = (i - 1) * hLen;
    const len = Math.min(hLen, dkLen - offset);
    DK.set(T.subarray(0, len), offset);
  }

  return DK;
}

// Derives an AES-GCM key from a password string using PBKDF2
export const deriveKey = async (password: string, salt: string): Promise<CryptoKey | Uint8Array> => {
  if (customPbkdf2) {
    return customPbkdf2(password, salt);
  }

  const subtle = getNativeSubtle();
  const enc = new TextEncoder();

  if (subtle) {
    const keyMaterial = await subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt) as any,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Pure JS Non-Blocking Fallback (React Native Hermes / Expo Go)
  return pbkdf2AsyncYielding(password, salt, { c: 100000, dkLen: 32, yieldInterval: 2000 });
};

// Encrypts plaintext string using AES-256-GCM with a random 12-byte IV
export const encrypt = async (key: CryptoKey | Uint8Array, plaintext: string): Promise<string> => {
  const subtle = getNativeSubtle();
  const iv = getRandomValues(12);
  const encoded = new TextEncoder().encode(plaintext);

  if (subtle && !(key instanceof Uint8Array)) {
    const ciphertextBuffer = await subtle.encrypt(
      { name: "AES-GCM", iv: iv as any },
      key as CryptoKey,
      encoded as any
    );
    const ciphertext = new Uint8Array(ciphertextBuffer);
    const payload = new Uint8Array(iv.length + ciphertext.length);
    payload.set(iv, 0);
    payload.set(ciphertext, iv.length);
    const binary = Array.from(payload).map((b) => String.fromCharCode(b)).join("");
    return btoa(binary);
  }

  // Pure JS Fallback (React Native Hermes / Expo Go)
  let rawKey: Uint8Array;
  if (key instanceof Uint8Array) {
    rawKey = key;
  } else {
    const rawBuffer = await subtle!.exportKey("raw", key as CryptoKey);
    rawKey = new Uint8Array(rawBuffer);
  }

  const aesGcm = gcm(rawKey, iv);
  const ciphertext = aesGcm.encrypt(encoded);
  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);

  const binary = Array.from(payload).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary);
};

// Decrypts packed AES-256-GCM Base64 payload
export const decrypt = async (key: CryptoKey | Uint8Array, packedPayloadBase64: string): Promise<string> => {
  const subtle = getNativeSubtle();
  const binary = atob(packedPayloadBase64);
  const payload = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    payload[i] = binary.charCodeAt(i);
  }

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);

  if (subtle && !(key instanceof Uint8Array)) {
    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key as CryptoKey,
      ciphertext as any
    );
    return new TextDecoder().decode(decrypted);
  }

  // Pure JS Fallback (React Native Hermes / Expo Go)
  let rawKey: Uint8Array;
  if (key instanceof Uint8Array) {
    rawKey = key;
  } else {
    const rawBuffer = await subtle!.exportKey("raw", key as CryptoKey);
    rawKey = new Uint8Array(rawBuffer);
  }

  const aesGcm = gcm(rawKey, iv);
  const decrypted = aesGcm.decrypt(ciphertext);
  return new TextDecoder().decode(decrypted);
};

/**
 * Encrypts raw binary bytes with AES-256-GCM (12-byte IV prepended).
 */
export const encryptBinary = async (
  key: CryptoKey | Uint8Array,
  bytes: Uint8Array
): Promise<Uint8Array> => {
  const iv = getRandomValues(12);
  const subtle = getNativeSubtle();

  if (subtle && !(key instanceof Uint8Array)) {
    // Use native SubtleCrypto — key may be non-extractable, so never call exportKey
    const ciphertextBuffer = await subtle.encrypt(
      { name: "AES-GCM", iv: iv as any },
      key as CryptoKey,
      bytes as any
    );
    const ciphertext = new Uint8Array(ciphertextBuffer);
    const payload = new Uint8Array(iv.length + ciphertext.length);
    payload.set(iv, 0);
    payload.set(ciphertext, iv.length);
    return payload;
  }

  // Pure JS fallback for Uint8Array keys (React Native / Hermes)
  const rawKey = key instanceof Uint8Array ? key : new Uint8Array(await subtle!.exportKey("raw", key as CryptoKey));
  const aesGcm = gcm(rawKey, iv);
  const ciphertext = aesGcm.encrypt(bytes);
  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);
  return payload;
};

/**
 * Decrypts raw binary bytes with AES-256-GCM (extracts 12-byte IV).
 */
export const decryptBinary = async (
  key: CryptoKey | Uint8Array,
  payload: Uint8Array
): Promise<Uint8Array> => {
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const subtle = getNativeSubtle();

  if (subtle && !(key instanceof Uint8Array)) {
    // Use native SubtleCrypto — key may be non-extractable, so never call exportKey
    const decryptedBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key as CryptoKey,
      ciphertext as any
    );
    return new Uint8Array(decryptedBuffer);
  }

  // Pure JS fallback for Uint8Array keys (React Native / Hermes)
  const rawKey = key instanceof Uint8Array ? key : new Uint8Array(await subtle!.exportKey("raw", key as CryptoKey));
  const aesGcm = gcm(rawKey, iv);
  return aesGcm.decrypt(ciphertext);
};

/**
 * Re-encrypts a list of encrypted blobs from an old key to a new key.
 */
export async function reEncryptBlobs(
  items: Array<{ id: string; encryptedBlob: string }>,
  oldKey: CryptoKey | Uint8Array,
  newKey: CryptoKey | Uint8Array,
  onProgress?: (done: number, total: number) => void
): Promise<Array<{ id: string; encryptedBlob: string }>> {
  const results: Array<{ id: string; encryptedBlob: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const plaintext = await decrypt(oldKey, item.encryptedBlob);
    const newBlob = await encrypt(newKey, plaintext);
    results.push({ id: item.id, encryptedBlob: newBlob });
    onProgress?.(i + 1, items.length);
  }

  return results;
}
