"use client";

import {
  deriveKey as coreDeriveKey,
  encrypt as coreEncrypt,
  decrypt as coreDecrypt,
} from "@vaultr/core";

// Derives an AES-GCM key from a password string using PBKDF2
export const deriveKey = async (password: string, salt: string): Promise<CryptoKey> => {
  const key = await coreDeriveKey(password, salt);
  return key as CryptoKey;
};

// Using GCM for built-in integrity check instead of manual HMAC
export const encrypt = async (key: CryptoKey | Uint8Array, plaintext: string): Promise<string> => {
  return coreEncrypt(key, plaintext);
};

export const decrypt = async (key: CryptoKey | Uint8Array, packedPayloadBase64: string): Promise<string> => {
  return coreDecrypt(key, packedPayloadBase64);
};

export const useCrypto = () => {
  return { encrypt, decrypt };
};

/**
 * Re-encrypts a list of encrypted blobs from an old key to a new key.
 * Used by the "Change Master Password" flow in /settings/security.
 *
 * Returns an array of { id, encryptedBlob } ready to batch-write to the database.
 * Each item is processed independently — a failure in one does NOT roll back others
 * (the caller should use a database transaction for atomicity after this resolves).
 */
export async function reEncryptBlobs(
  items: Array<{ id: string; encryptedBlob: string }>,
  oldKey: CryptoKey,
  newKey: CryptoKey,
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
