/**
 * VaultR WebAuthn Page-Context Interceptor
 * Injected into the page's MAIN JavaScript execution world to intercept
 * navigator.credentials.create and navigator.credentials.get for VaultR Passkey Provider.
 *
 * Fully conforms to the W3C WebAuthn Level 2/3 specification.
 * Falls back to native browser credentials if VaultR is locked, disabled, or declined by the user.
 */

(function () {
  if ((window as any).__VAULTR_WEBAUTHN_INITIALIZED__) return;
  (window as any).__VAULTR_WEBAUTHN_INITIALIZED__ = true;

  const originalCreate = navigator.credentials ? navigator.credentials.create.bind(navigator.credentials) : null;
  const originalGet = navigator.credentials ? navigator.credentials.get.bind(navigator.credentials) : null;

  // ─── Platform Authenticator Capabilities Overrides ───────────────────────────
  if (typeof window.PublicKeyCredential !== "undefined") {
    // Overriding isUserVerifyingPlatformAuthenticatorAvailable informs relying parties
    // that VaultR platform passkeys are supported in this browser.
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function () {
      return true;
    };

    // Inform relying parties that conditional mediation UI (autofill) is not active.
    // This prevents relying parties like Google Accounts from triggering background conditional requests on page load.
    (window.PublicKeyCredential as any).isConditionalMediationAvailable = async function () {
      return false;
    };

    if (typeof (window.PublicKeyCredential as any).getClientCapabilities === "function") {
      (window.PublicKeyCredential as any).getClientCapabilities = async function () {
        return {
          conditionalCreate: false,
          conditionalGet: false,
          hybridTransport: true,
          passkeyPlatformAuthenticator: true,
          userVerificationMethod: true,
        };
      };
    }
  }

  // ─── Encoding Helpers ───────────────────────────────────────────────────────

  function bufferToBase64Url(buf: any): string {
    if (!buf) return "";
    if (typeof buf === "string") return buf;
    try {
      const bytes = buf instanceof Uint8Array
        ? buf
        : (ArrayBuffer.isView(buf)
            ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
            : new Uint8Array(buf));
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch {
      return "";
    }
  }

  function base64UrlToBuffer(val: any): ArrayBuffer {
    if (!val) return new ArrayBuffer(0);
    if (val instanceof ArrayBuffer) return val.slice(0);
    if (ArrayBuffer.isView(val)) {
      const copy = new Uint8Array(val.byteLength);
      copy.set(new Uint8Array(val.buffer as any, val.byteOffset, val.byteLength));
      return copy.buffer;
    }
    if (typeof val !== "string") return new ArrayBuffer(0);
    let base64 = val.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.slice().buffer;
  }

  // ─── Serializers ───────────────────────────────────────────────────────────

  function serializeCreationOptions(options: CredentialCreationOptions): any {
    const pk = options.publicKey;
    if (!pk) return null;

    const effectiveRpId = pk.rp?.id || window.location.hostname;
    const effectiveRpName = pk.rp?.name || effectiveRpId;

    return {
      challenge: bufferToBase64Url(pk.challenge),
      rp: {
        id: effectiveRpId,
        name: effectiveRpName,
      },
      user: {
        id: bufferToBase64Url(pk.user.id),
        name: pk.user.name || "",
        displayName: pk.user.displayName || pk.user.name || "",
      },
      pubKeyCredParams: pk.pubKeyCredParams,
      timeout: pk.timeout,
      excludeCredentials: pk.excludeCredentials?.map((c) => ({
        id: bufferToBase64Url(c.id),
        type: c.type,
        transports: c.transports,
      })),
      authenticatorSelection: pk.authenticatorSelection,
      attestation: pk.attestation,
      origin: window.location.origin,
    };
  }

  function serializeRequestOptions(options: CredentialRequestOptions): any {
    const pk = options.publicKey;
    if (!pk) return null;

    return {
      challenge: bufferToBase64Url(pk.challenge),
      rpId: pk.rpId || window.location.hostname,
      timeout: pk.timeout,
      allowCredentials: pk.allowCredentials?.map((c) => ({
        id: bufferToBase64Url(c.id),
        type: c.type,
        transports: c.transports,
      })),
      userVerification: pk.userVerification,
      origin: window.location.origin,
    };
  }

  // ─── Bridge to Isolated Content Script ─────────────────────────────────────

  function dispatchToExtension(
    action: "CREATE" | "GET",
    payload: any,
    timeoutMs: number = 60000,
    signal?: AbortSignal | null
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }

      const reqId = "vtr_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const safeTimeout = Math.max(10000, Math.min(timeoutMs, 120000));

      const abortHandler = () => {
        clearTimeout(timeout);
        window.removeEventListener("message", listener);
        window.postMessage(
          {
            source: "VAULTR_WEBAUTHN_PAGE",
            action: "ABORT",
            reqId,
          },
          "*"
        );
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };

      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      const timeout = setTimeout(() => {
        if (signal) signal.removeEventListener("abort", abortHandler);
        window.removeEventListener("message", listener);
        resolve({ handled: false, timeout: true });
      }, safeTimeout);

      const listener = (event: MessageEvent) => {
        if (
          event.source !== window ||
          !event.data ||
          event.data.source !== "VAULTR_WEBAUTHN_CONTENT" ||
          event.data.reqId !== reqId
        ) {
          return;
        }
        clearTimeout(timeout);
        if (signal) signal.removeEventListener("abort", abortHandler);
        window.removeEventListener("message", listener);
        resolve(event.data);
      };

      window.addEventListener("message", listener);
      window.postMessage(
        {
          source: "VAULTR_WEBAUTHN_PAGE",
          action,
          reqId,
          payload,
        },
        "*"
      );
    });
  }

  // ─── Intercept navigator.credentials.create ────────────────────────────────

  async function interceptedCreate(options?: CredentialCreationOptions): Promise<Credential | null> {
    if (!options?.publicKey || !originalCreate) {
      return originalCreate ? originalCreate(options) : null;
    }

    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    try {
      const serialized = serializeCreationOptions(options);
      if (!serialized) return originalCreate(options);

      const timeoutMs = options.publicKey.timeout || 60000;
      const res = await dispatchToExtension("CREATE", serialized, timeoutMs, options.signal);

      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.credentialId || c.id);
        const encodedClientData = new TextEncoder().encode(c.clientDataJSON);
        const clientDataJSON = new Uint8Array(encodedClientData).slice().buffer as ArrayBuffer;
        const attestationObject = base64UrlToBuffer(c.attestationObject);
        const authenticatorData = c.authenticatorData ? base64UrlToBuffer(c.authenticatorData) : new ArrayBuffer(0);
        const publicKey = c.publicKey ? base64UrlToBuffer(c.publicKey) : null;

        // Build AuthenticatorAttestationResponse with authentic prototype
        const attestationProto = typeof AuthenticatorAttestationResponse !== "undefined"
          ? AuthenticatorAttestationResponse.prototype
          : (typeof AuthenticatorResponse !== "undefined" ? (AuthenticatorResponse as any).prototype : Object.prototype);

        const responseObj = Object.create(attestationProto);
        Object.defineProperties(responseObj, {
          clientDataJSON: { value: clientDataJSON, enumerable: true, configurable: true },
          attestationObject: { value: attestationObject, enumerable: true, configurable: true },
          getTransports: { value: () => ["internal", "hybrid"], enumerable: true, configurable: true },
          getAuthenticatorData: { value: () => authenticatorData, enumerable: true, configurable: true },
          getPublicKey: { value: () => publicKey, enumerable: true, configurable: true },
          getPublicKeyAlgorithm: { value: () => -7, enumerable: true, configurable: true },
        });

        // Build PublicKeyCredential with authentic prototype
        const credProto = typeof PublicKeyCredential !== "undefined"
          ? PublicKeyCredential.prototype
          : (typeof Credential !== "undefined" ? (Credential as any).prototype : Object.prototype);

        const syntheticCredential = Object.create(credProto);
        Object.defineProperties(syntheticCredential, {
          id: { value: c.credentialId || c.id, enumerable: true, configurable: true },
          rawId: { value: rawId, enumerable: true, configurable: true },
          type: { value: "public-key", enumerable: true, configurable: true },
          authenticatorAttachment: { value: "platform", enumerable: true, configurable: true },
          response: { value: responseObj, enumerable: true, configurable: true },
          getClientExtensionResults: { value: () => ({ credProps: { rk: true } }), enumerable: true, configurable: true },
          toJSON: {
            value: () => ({
              id: c.credentialId || c.id,
              rawId: c.credentialId || c.id,
              response: {
                clientDataJSON: bufferToBase64Url(clientDataJSON),
                attestationObject: c.attestationObject,
                transports: ["internal", "hybrid"],
                authenticatorData: c.authenticatorData,
                publicKeyAlgorithm: -7,
                publicKey: c.publicKey,
              },
              authenticatorAttachment: "platform",
              clientExtensionResults: { credProps: { rk: true } },
              type: "public-key",
            }),
            enumerable: true,
            configurable: true,
          },
        });

        return syntheticCredential as PublicKeyCredential;
      }

      // If user confirmed creation via VaultR prompt, NEVER fall back to Windows Hello!
      if (res?.userConfirmed) {
        throw new DOMException(res.error || "Failed to create passkey in VaultR", "NotAllowedError");
      }

      // If user explicitly chose "Use Browser"
      if (res?.userCancelled) {
        return originalCreate(options);
      }

      // If VaultR didn't handle it (vault locked, passkeys disabled)
      if (!res?.handled) {
        return originalCreate(options);
      }
    } catch (err: any) {
      if (err instanceof DOMException || err?.name === "NotAllowedError") {
        throw err;
      }
      console.warn("[VaultR WebAuthn] Create fallback:", err);
    }

    return originalCreate(options);
  }

  // ─── Intercept navigator.credentials.get ───────────────────────────────────

  async function interceptedGet(options?: CredentialRequestOptions): Promise<Credential | null> {
    if (!options?.publicKey || !originalGet) {
      return originalGet ? originalGet(options) : null;
    }

    // Do NOT delegate conditional mediation to originalGet!
    // Calling originalGet causes Chrome to display the browser's in-built passkey prompt.
    // Return a quiet pending Promise that stays dormant and cleanly aborts when the RP cancels.
    if (options.mediation === "conditional") {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return new Promise<Credential | null>((resolve, reject) => {
        const onAbort = () => {
          options.signal?.removeEventListener("abort", onAbort);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        };
        options.signal?.addEventListener("abort", onAbort, { once: true });
        const timeoutMs = options.publicKey?.timeout || 60000;
        setTimeout(() => {
          options.signal?.removeEventListener("abort", onAbort);
          resolve(null);
        }, Math.min(timeoutMs, 120000));
      });
    }

    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    try {
      const serialized = serializeRequestOptions(options);
      // Can't serialize — not a public-key request VaultR handles
      if (!serialized) return originalGet ? originalGet(options) : null;

      const timeoutMs = options.publicKey.timeout || 60000;
      const res = await dispatchToExtension("GET", serialized, timeoutMs, options.signal);

      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.id || c.credentialId);
        const encodedClientData = new TextEncoder().encode(c.clientDataJSON);
        const clientDataJSON = new Uint8Array(encodedClientData).slice().buffer as ArrayBuffer;
        const authenticatorData = base64UrlToBuffer(c.authenticatorData);
        const signature = base64UrlToBuffer(c.signature);
        const userHandle = c.userHandle ? base64UrlToBuffer(c.userHandle) : null;

        // Build AuthenticatorAssertionResponse with authentic prototype
        const assertionProto = typeof AuthenticatorAssertionResponse !== "undefined"
          ? AuthenticatorAssertionResponse.prototype
          : (typeof AuthenticatorResponse !== "undefined" ? (AuthenticatorResponse as any).prototype : Object.prototype);

        const responseObj = Object.create(assertionProto);
        Object.defineProperties(responseObj, {
          clientDataJSON: { value: clientDataJSON, enumerable: true, configurable: true },
          authenticatorData: { value: authenticatorData, enumerable: true, configurable: true },
          signature: { value: signature, enumerable: true, configurable: true },
          userHandle: { value: userHandle, enumerable: true, configurable: true },
        });

        // Build PublicKeyCredential with authentic prototype
        const credProto = typeof PublicKeyCredential !== "undefined"
          ? PublicKeyCredential.prototype
          : (typeof Credential !== "undefined" ? (Credential as any).prototype : Object.prototype);

        const syntheticCredential = Object.create(credProto);
        Object.defineProperties(syntheticCredential, {
          id: { value: c.id || c.credentialId, enumerable: true, configurable: true },
          rawId: { value: rawId, enumerable: true, configurable: true },
          type: { value: "public-key", enumerable: true, configurable: true },
          authenticatorAttachment: { value: "platform", enumerable: true, configurable: true },
          response: { value: responseObj, enumerable: true, configurable: true },
          getClientExtensionResults: { value: () => ({}), enumerable: true, configurable: true },
          toJSON: {
            value: () => ({
              id: c.id || c.credentialId,
              rawId: c.id || c.credentialId,
              response: {
                authenticatorData: c.authenticatorData,
                clientDataJSON: bufferToBase64Url(clientDataJSON),
                signature: c.signature,
                userHandle: c.userHandle || null,
              },
              authenticatorAttachment: "platform",
              clientExtensionResults: {},
              type: "public-key",
            }),
            enumerable: true,
            configurable: true,
          },
        });

        return syntheticCredential as PublicKeyCredential;
      }

      // User confirmed but VaultR assertion failed — do NOT open browser prompt
      if (res?.userConfirmed) {
        throw new DOMException(res.error || "VaultR passkey assertion failed", "NotAllowedError");
      }

      // User explicitly clicked "Use Browser" — only legitimate handoff to browser
      if (res?.userCancelled) {
        return originalGet ? originalGet(options) : null;
      }

      // Vault is locked — do NOT open browser prompt, surface error
      if (res?.error === "locked") {
        throw new DOMException("Vault is locked. Unlock VaultR to sign in with passkey.", "NotAllowedError");
      }

      // No passkey found in VaultR for this RP — do NOT open browser prompt
      // The RP registered this passkey with VaultR; handing off to the browser would
      // show Windows Hello with no key to offer (or worse, offer a stale OS-level passkey).
      if (!res?.handled) {
        throw new DOMException(
          res?.error || "No VaultR passkey found for this site. Please re-register your passkey.",
          "NotAllowedError"
        );
      }
    } catch (err: any) {
      if (err instanceof DOMException || err?.name === "NotAllowedError" || err?.name === "AbortError") {
        throw err;
      }
      // Internal VaultR error — do NOT fall back to browser prompt
      throw new DOMException("VaultR passkey sign-in failed. Please try again.", "NotAllowedError");
    }

    // Should not be reached — but if somehow we get here, throw rather than open browser prompt
    throw new DOMException("VaultR passkey sign-in failed.", "NotAllowedError");
  }

  // ─── Attach Interceptors ───────────────────────────────────────────────────

  if (typeof CredentialsContainer !== "undefined" && CredentialsContainer.prototype) {
    CredentialsContainer.prototype.create = interceptedCreate as any;
    CredentialsContainer.prototype.get = interceptedGet as any;
  }

  if (navigator.credentials) {
    navigator.credentials.create = interceptedCreate;
    navigator.credentials.get = interceptedGet;
  }
})();
