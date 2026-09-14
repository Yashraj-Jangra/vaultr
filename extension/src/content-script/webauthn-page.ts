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

    if (typeof window.PublicKeyCredential.isConditionalMediationAvailable === "function") {
      window.PublicKeyCredential.isConditionalMediationAvailable = async function () {
        return true;
      };
    }

    if (typeof (window.PublicKeyCredential as any).getClientCapabilities === "function") {
      (window.PublicKeyCredential as any).getClientCapabilities = async function () {
        return {
          conditionalCreate: true,
          conditionalGet: true,
          hybridTransport: true,
          passkeyPlatformAuthenticator: true,
          userVerificationMethod: true,
        };
      };
    }
  }

  // ─── Encoding Helpers ───────────────────────────────────────────────────────

  function bufferToBase64Url(buf: ArrayBuffer | ArrayBufferView): string {
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
  }

  function base64UrlToBuffer(str: string): ArrayBuffer {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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

  function dispatchToExtension(action: "CREATE" | "GET", payload: any, timeoutMs: number = 60000): Promise<any> {
    return new Promise((resolve) => {
      const reqId = "vtr_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const safeTimeout = Math.max(10000, Math.min(timeoutMs, 120000));

      const timeout = setTimeout(() => {
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

    try {
      const serialized = serializeCreationOptions(options);
      if (!serialized) return originalCreate(options);

      const timeoutMs = options.publicKey.timeout || 60000;
      const res = await dispatchToExtension("CREATE", serialized, timeoutMs);

      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.credentialId || c.id);
        const clientDataJSON = new TextEncoder().encode(c.clientDataJSON).buffer;
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
          getClientExtensionResults: { value: () => ({}), enumerable: true, configurable: true },
        });

        return syntheticCredential as PublicKeyCredential;
      }
    } catch (err) {
      console.warn("[VaultR WebAuthn] Create fallback:", err);
    }

    return originalCreate(options);
  }

  // ─── Intercept navigator.credentials.get ───────────────────────────────────

  async function interceptedGet(options?: CredentialRequestOptions): Promise<Credential | null> {
    if (!options?.publicKey || !originalGet) {
      return originalGet ? originalGet(options) : null;
    }

    try {
      const serialized = serializeRequestOptions(options);
      if (!serialized) return originalGet(options);

      const timeoutMs = options.publicKey.timeout || 60000;
      const res = await dispatchToExtension("GET", serialized, timeoutMs);

      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.id || c.credentialId);
        const clientDataJSON = new TextEncoder().encode(c.clientDataJSON).buffer;
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
        });

        return syntheticCredential as PublicKeyCredential;
      }
    } catch (err) {
      console.warn("[VaultR WebAuthn] Assertion fallback:", err);
    }

    return originalGet(options);
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
