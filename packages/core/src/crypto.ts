/**
 * Environment-agnostic WebCrypto utilities.
 * Works in browsers, Chrome extension background service workers, Node.js (19+), and React Native (with polyfill).
 */

function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto as Crypto;
  }
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto;
  }
  throw new Error("WebCrypto API is not available in this runtime environment.");
}

// Derives an AES-GCM key from a password string using PBKDF2
export const deriveKey = async (password: string, salt: string): Promise<CryptoKey> => {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// Encrypts plaintext string using AES-256-GCM with a random 12-byte IV
export const encrypt = async (key: CryptoKey, plaintext: string): Promise<string> => {
  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);

  // Convert to Base64 for database storage
  const binary = Array.from(payload).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary);
};

// Decrypts packed AES-256-GCM Base64 payload
export const decrypt = async (key: CryptoKey, packedPayloadBase64: string): Promise<string> => {
  const crypto = getCrypto();
  const binary = atob(packedPayloadBase64);
  const payload = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    payload[i] = binary.charCodeAt(i);
  }

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
};

/**
 * Re-encrypts a list of encrypted blobs from an old key to a new key.
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
