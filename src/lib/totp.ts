/**
 * Pure-TypeScript TOTP implementation (RFC 6238)
 * Uses WebCrypto API, zero native Node.js dependencies.
 */

// Basic Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodes a Base32 string into a Uint8Array.
 * Ignores whitespace, padding (=), and case.
 */
export function base32ToUint8Array(base32Secret: string): Uint8Array {
  let secret = base32Secret;

  // Extract secret if user accidentally pastes full URI
  if (secret.startsWith("otpauth://")) {
    try {
      const url = new URL(secret);
      const param = url.searchParams.get("secret");
      if (param) secret = param;
    } catch {
      // ignore parsing errors, fallback to raw string
    }
  }

  // Clean up input: remove spaces, hyphens, equals signs, convert to uppercase
  const cleaned = secret.replace(/[\s=_-]/g, "").toUpperCase();

  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.ceil((cleaned.length * 5) / 8));

  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned.charAt(i));
    if (val === -1) {
      throw new Error(`Invalid Base32 character found: ${cleaned.charAt(i)}`);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  // Trim to actual used length
  return output.slice(0, index);
}

/**
 * Converts a number to an 8-byte Uint8Array (Big Endian)
 */
function numberToUint8Array(num: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // We use high/low 32-bit trick to avoid BigInt which might not be needed
  view.setUint32(0, Math.floor(num / Math.pow(2, 32)), false); // high
  view.setUint32(4, num & 0xffffffff, false); // low
  return new Uint8Array(buf);
}

/**
 * Generates a 6-digit TOTP code for the given Base32 secret and time.
 * @param base32Secret The Base32 encoded secret (e.g., from an authenticator URI)
 * @param timeMs The current time in milliseconds (defaults to Date.now())
 * @param stepMs The TOTP step interval in milliseconds (defaults to 30000)
 */
export async function generateTOTP(
  base32Secret: string,
  timeMs: number = Date.now(),
  stepMs: number = 30000
): Promise<string> {
  const keyBytes = base32ToUint8Array(base32Secret);
  const counter = Math.floor(timeMs / stepMs);
  const counterBytes = numberToUint8Array(counter);

  // Import key for HMAC-SHA1
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyBytes as any,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // Sign the counter
  const signature = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    counterBytes as any
  );

  const hash = new Uint8Array(signature as ArrayBuffer);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  // Take the last 6 digits
  const otp = (binary % 1000000).toString();
  return otp.padStart(6, "0");
}

/**
 * Returns the number of seconds remaining in the current 30s TOTP window.
 */
export function getTotpCountdown(timeMs: number = Date.now(), stepMs: number = 30000): number {
  return Math.ceil((stepMs - (timeMs % stepMs)) / 1000);
}

/**
 * Returns the percentage (0-100) remaining in the current 30s TOTP window.
 */
export function getTotpPercentage(timeMs: number = Date.now(), stepMs: number = 30000): number {
  return 100 - ((timeMs % stepMs) / stepMs) * 100;
}
