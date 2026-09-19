/**
 * WebAuthn & FIDO2 Passkey Cryptography Utilities.
 * Zero external dependencies — built strictly on WebCrypto (SubtleCrypto) standards.
 * Supports:
 *  - Passkey credential generation (ECDSA P-256 / ES256)
 *  - FIDO2 Authenticator Data & CBOR "none" Attestation Object serialization
 *  - Passkey assertion cryptographic signing (DER formatted)
 *  - Platform Authenticator biometric re-unlock (Windows Hello / Touch ID)
 */

// ─── Base64URL Encoding / Decoding ───────────────────────────────────────────

export function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa !== "undefined"
    ? btoa(binary)
    : (typeof (globalThis as any).Buffer !== "undefined" ? (globalThis as any).Buffer.from(binary, "binary").toString("base64") : "");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = typeof atob !== "undefined"
    ? atob(base64)
    : (typeof (globalThis as any).Buffer !== "undefined" ? (globalThis as any).Buffer.from(base64, "base64").toString("binary") : "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── SHA-256 Helper ─────────────────────────────────────────────────────────

async function sha256Bytes(data: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes as any);
  return new Uint8Array(hash);
}

// ─── Lightweight CBOR & COSE Key Serialization ──────────────────────────────

/**
 * Encodes an ECDSA P-256 public key into standard COSE Key format (CBOR).
 * RFC 8152 / 9052:
 *  1: 2    (kty: EC2)
 *  3: -7   (alg: ES256)
 * -1: 1    (crv: P-256)
 * -2: x    (x coordinate, 32 bytes)
 * -3: y    (y coordinate, 32 bytes)
 */
export function encodeCoseKeyP256(xCoord: Uint8Array, yCoord: Uint8Array): Uint8Array {
  // Map of 5 items: 0xa5
  // 1 => 2:        0x01, 0x02
  // 3 => -7:       0x03, 0x26 (-7 is encoded as 0x20 + 6 = 0x26)
  // -1 => 1:       0x20, 0x01 (-1 is encoded as 0x20)
  // -2 => bstr(32): 0x21, 0x58, 0x20, [32 bytes x] (-2 is encoded as 0x21, 32 bytes is 0x58, 0x20)
  // -3 => bstr(32): 0x22, 0x58, 0x20, [32 bytes y] (-3 is encoded as 0x22, 32 bytes is 0x58, 0x20)
  const header = new Uint8Array([
    0xa5,
    0x01, 0x02,
    0x03, 0x26,
    0x20, 0x01,
    0x21, 0x58, 0x20,
  ]);
  const mid = new Uint8Array([0x22, 0x58, 0x20]);

  const totalLen = header.length + xCoord.length + mid.length + yCoord.length;
  const out = new Uint8Array(totalLen);
  let offset = 0;

  out.set(header, offset); offset += header.length;
  out.set(xCoord, offset); offset += xCoord.length;
  out.set(mid, offset); offset += mid.length;
  out.set(yCoord, offset); offset += yCoord.length;

  return out;
}

/**
 * Encodes attestationObject in canonical CBOR with fmt: "none" and empty attStmt {}.
 * Map of 3 items (canonically sorted by length then byte value):
 *  1. "fmt" => "none" (len 3)
 *  2. "attStmt" => {} (len 7)
 *  3. "authData" => bytes (len 8)
 */
export function encodeAttestationObjectNone(authData: Uint8Array): Uint8Array {
  const keysAndFmt = [
    // "fmt": "none"
    0x63, 0x66, 0x6d, 0x74,
    0x64, 0x6e, 0x6f, 0x6e, 0x65,
    // "attStmt": {}
    0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74,
    0xa0,
    // "authData" key
    0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61,
  ];

  let lenHeader: number[];
  const len = authData.length;
  if (len < 24) {
    lenHeader = [0x40 + len];
  } else if (len <= 0xff) {
    lenHeader = [0x58, len];
  } else if (len <= 0xffff) {
    lenHeader = [0x59, (len >> 8) & 0xff, len & 0xff];
  } else {
    lenHeader = [0x5a, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];
  }

  const out = new Uint8Array(1 + keysAndFmt.length + lenHeader.length + authData.length);
  out[0] = 0xa3; // Canonical CBOR map of 3 pairs
  out.set(keysAndFmt, 1);
  out.set(lenHeader, 1 + keysAndFmt.length);
  out.set(authData, 1 + keysAndFmt.length + lenHeader.length);

  return out;
}

// ─── IEEE P1363 to ASN.1 DER Signature Converter ─────────────────────────────

/**
 * SubtleCrypto returns ECDSA signatures in IEEE P1363 (r || s, 64 bytes).
 * WebAuthn standard requires ASN.1 DER formatted sequence of 2 integers.
 */
export function p1363ToDer(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) {
    // Already DER or non-standard
    return signature;
  }
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);

  function encodeInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    const needsZero = trimmed.length === 0 || (trimmed[0] & 0x80) !== 0;
    const len = trimmed.length + (needsZero ? 1 : 0);
    const res = new Uint8Array(2 + len);
    res[0] = 0x02; // INTEGER tag
    res[1] = len;
    if (needsZero) {
      res[2] = 0x00;
      res.set(trimmed, 3);
    } else {
      res.set(trimmed, 2);
    }
    return res;
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  const seqLen = rDer.length + sDer.length;
  const der = new Uint8Array(2 + seqLen);
  der[0] = 0x30; // SEQUENCE tag
  der[1] = seqLen;
  der.set(rDer, 2);
  der.set(sDer, 2 + rDer.length);
  return der;
}

// ─── Passkey Credential Registration (FIDO2 MakeCredential) ───────────────────

export interface CreatePasskeyParams {
  rpId: string;
  rpName?: string;
  userName?: string;
  userDisplayName?: string;
  userHandle?: string;
  challenge: string; // Base64URL
  origin: string;
}

export interface CreatedPasskeyResult {
  credentialId: string;         // Base64URL
  rawId: ArrayBuffer;
  passkeyPrivateKey: string;    // Base64URL PKCS#8
  passkeyUserHandle: string;    // Base64URL
  passkeyRpId: string;
  clientDataJSON: string;       // JSON string
  attestationObject: Uint8Array;
  authenticatorData: Uint8Array;
  publicKeySpki: Uint8Array;
}

export async function createPasskeyCredential(params: CreatePasskeyParams): Promise<CreatedPasskeyResult> {
  const { challenge, origin, userHandle } = params;
  let effectiveRpId = params.rpId;
  if (!effectiveRpId) {
    try {
      effectiveRpId = new URL(origin).hostname;
    } catch {
      effectiveRpId = "localhost";
    }
  }

  // 1. Generate ECDSA P-256 keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  // 2. Export public key as raw uncompressed coordinates and SPKI
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));

  // raw format is 0x04 || X (32) || Y (32)
  const xCoord = rawPub.slice(1, 33);
  const yCoord = rawPub.slice(33, 65);
  const coseKey = encodeCoseKeyP256(xCoord, yCoord);

  // 3. Export private key as PKCS#8
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
  const passkeyPrivateKey = toBase64Url(pkcs8);

  // 4. Generate random 16-byte credential ID
  const credIdBytes = crypto.getRandomValues(new Uint8Array(16));
  const credentialId = toBase64Url(credIdBytes);

  // 5. Build Authenticator Data with Attested Credential Data
  const rpIdHash = await sha256Bytes(effectiveRpId);
  const flags = 0x01 | 0x04 | 0x40; // UP (0x01) | UV (0x04) | AT (0x40)
  const signCount = 0;
  const aaguid = new Uint8Array(16); // 16 zeroes for platform / software passkey

  const credIdLenBytes = new Uint8Array([
    (credIdBytes.length >> 8) & 0xff,
    credIdBytes.length & 0xff,
  ]);

  const authDataLen = 32 + 1 + 4 + 16 + 2 + credIdBytes.length + coseKey.length;
  const authData = new Uint8Array(authDataLen);
  let offset = 0;

  authData.set(rpIdHash, offset); offset += 32;
  authData[offset] = flags; offset += 1;
  const view = new DataView(authData.buffer);
  view.setUint32(offset, signCount, false); offset += 4;
  authData.set(aaguid, offset); offset += 16;
  authData.set(credIdLenBytes, offset); offset += 2;
  authData.set(credIdBytes, offset); offset += credIdBytes.length;
  authData.set(coseKey, offset);

  // 6. Build Attestation Object (fmt: "none" + attStmt: {})
  const attestationObject = encodeAttestationObjectNone(authData);

  // 7. Build clientDataJSON
  const clientData = {
    type: "webauthn.create",
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = JSON.stringify(clientData);

  const finalUserHandle = userHandle || toBase64Url(new TextEncoder().encode(params.userName || "user"));

  return {
    credentialId,
    rawId: credIdBytes.buffer,
    passkeyPrivateKey,
    passkeyUserHandle: finalUserHandle,
    passkeyRpId: effectiveRpId,
    clientDataJSON,
    attestationObject,
    authenticatorData: authData,
    publicKeySpki: spki,
  };
}

// ─── Passkey Assertion Signing (FIDO2 GetAssertion) ──────────────────────────

export interface SignPasskeyAssertionParams {
  passkeyPrivateKey: string; // Base64URL PKCS#8
  rpId: string;
  challenge: string;         // Base64URL
  origin: string;
  signCount: number;
}

export interface SignedPasskeyAssertionResult {
  authenticatorData: Uint8Array;
  clientDataJSON: string;
  signature: Uint8Array;     // ASN.1 DER formatted
}

export async function signPasskeyAssertion(params: SignPasskeyAssertionParams): Promise<SignedPasskeyAssertionResult> {
  const { passkeyPrivateKey, rpId, challenge, origin, signCount } = params;

  // 1. Import private key
  const privKeyBytes = fromBase64Url(passkeyPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privKeyBytes as any,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // 2. Build Authenticator Data (37 bytes: rpIdHash[32] + flags[1] + counter[4])
  const rpIdHash = await sha256Bytes(rpId);
  const flags = 0x01 | 0x04; // User Present (UP) + User Verified (UV)

  const authData = new Uint8Array(37);
  authData.set(rpIdHash, 0);
  authData[32] = flags;
  const view = new DataView(authData.buffer);
  view.setUint32(33, signCount, false); // big-endian counter

  // 3. Build clientDataJSON
  const clientData = {
    type: "webauthn.get",
    challenge,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = JSON.stringify(clientData);
  const clientDataHash = await sha256Bytes(clientDataJSON);

  // 4. Sign (authData || clientDataHash)
  const signInput = new Uint8Array(authData.length + clientDataHash.length);
  signInput.set(authData, 0);
  signInput.set(clientDataHash, authData.length);

  const rawSig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      cryptoKey,
      signInput
    )
  );

  // Convert IEEE P1363 signature to DER
  const signature = p1363ToDer(rawSig);

  return {
    authenticatorData: authData,
    clientDataJSON,
    signature,
  };
}

// ─── Platform Authenticator Biometric Re-Unlock (Windows Hello / Touch ID) ───

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const BIO_SALT = new TextEncoder().encode("vaultr-extension-biometrics-v1");

/**
 * Enrolls device biometric unlock using the browser's platform authenticator (Windows Hello, Touch ID).
 * Hardware gates the creation, and encrypts the master password in device-local storage.
 */
export async function enrollBiometricUnlock(masterPassword: string): Promise<{
  credentialId: string;
  encryptedPassword: string;
  iv: string;
}> {
  if (typeof window === "undefined" || !navigator.credentials) {
    throw new Error("WebAuthn credentials API is unavailable in this environment.");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const rp: { name: string; id?: string } = { name: "VaultR" };
  const hostname = typeof window !== "undefined" ? window.location?.hostname : "";
  const protocol = typeof window !== "undefined" ? window.location?.protocol : "";
  // In extension origins (chrome-extension://, moz-extension://) or empty hostnames, omitting rp.id
  // lets the browser automatically use the extension's origin without throwing SecurityError.
  if (hostname && !protocol?.includes("extension") && hostname.includes(".")) {
    rp.id = hostname;
  }

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp,
      user: {
        id: userId,
        name: "vaultr-user",
        displayName: "VaultR User",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) {
    throw new Error("Biometric enrollment cancelled or rejected.");
  }

  const credentialId = toBase64Url(new Uint8Array(cred.rawId));

  // Generate AES-256-GCM wrapping key derived with HKDF from local credential + salt
  const rawKeyMaterial = await crypto.subtle.digest("SHA-256", new Uint8Array(cred.rawId) as any);
  const baseKey = await crypto.subtle.importKey("raw", rawKeyMaterial as any, "HKDF", false, ["deriveKey"]);
  const wrapKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: BIO_SALT as any, info: BIO_SALT as any },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encPass = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    wrapKey,
    new TextEncoder().encode(masterPassword) as any
  );

  return {
    credentialId,
    encryptedPassword: toBase64Url(encPass),
    iv: toBase64Url(iv),
  };
}

/**
 * Re-authenticates with Windows Hello / Touch ID and recovers the master password.
 */
export async function unlockWithBiometrics(
  credentialId: string,
  encryptedPassword: string,
  iv: string
): Promise<string> {
  if (typeof window === "undefined" || !navigator.credentials) {
    throw new Error("WebAuthn credentials API is unavailable.");
  }

  const credIdBytes = fromBase64Url(credentialId);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: credIdBytes as any, type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Biometric verification cancelled.");
  }

  // Derive AES-256-GCM wrapping key
  const rawKeyMaterial = await crypto.subtle.digest("SHA-256", new Uint8Array(assertion.rawId) as any);
  const baseKey = await crypto.subtle.importKey("raw", rawKeyMaterial as any, "HKDF", false, ["deriveKey"]);
  const wrapKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: BIO_SALT as any, info: BIO_SALT as any },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const ivBytes = fromBase64Url(iv);
  const encBytes = fromBase64Url(encryptedPassword);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as any },
    wrapKey,
    encBytes as any
  );

  return new TextDecoder().decode(decrypted);
}
