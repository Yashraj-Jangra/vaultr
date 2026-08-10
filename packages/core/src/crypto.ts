/**
 * Environment-agnostic WebCrypto utilities.
 * Works in browsers, Chrome extension background service workers, Node.js (19+), and React Native / Hermes (via 0-dependency @noble fallback).
 */

import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
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
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

// Derives an AES-GCM key from a password string using PBKDF2
export const deriveKey = async (password: string, salt: string): Promise<CryptoKey | Uint8Array> => {
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

  // Pure JS Fallback (React Native Hermes / Expo Go)
  const passBytes = enc.encode(password);
  const saltBytes = enc.encode(salt);
  return pbkdf2(sha256, passBytes, saltBytes, { c: 100000, dkLen: 32 });
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
