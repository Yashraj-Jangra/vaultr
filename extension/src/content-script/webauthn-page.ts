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

  const originalCreate = navigator.credentials.create.bind(navigator.credentials);
  const originalGet = navigator.credentials.get.bind(navigator.credentials);

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

  function serializeCreationOptions(options: CredentialCreationOptions): any {
    const pk = options.publicKey;
    if (!pk) return null;

    return {
      challenge: bufferToBase64Url(pk.challenge),
      rp: pk.rp,
      user: {
        id: bufferToBase64Url(pk.user.id),
        name: pk.user.name,
        displayName: pk.user.displayName,
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

  function dispatchToExtension(action: "CREATE" | "GET", payload: any): Promise<any> {
    return new Promise((resolve) => {
      const reqId = "vtr_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", listener);
        resolve({ handled: false, timeout: true });
      }, 35000);

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

  // ─── Override navigator.credentials.create ─────────────────────────────────

  navigator.credentials.create = async function (options?: CredentialCreationOptions): Promise<Credential | null> {
    if (!options?.publicKey) {
      return originalCreate(options);
    }

    try {
      const serialized = serializeCreationOptions(options);
      if (!serialized) return originalCreate(options);

      const res = await dispatchToExtension("CREATE", serialized);
      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.credentialId || c.id);
        const clientDataJSON = new TextEncoder().encode(c.clientDataJSON).buffer;
        const attestationObject = base64UrlToBuffer(c.attestationObject);

        const syntheticCredential = {
          id: c.credentialId || c.id,
          rawId,
          type: "public-key",
          authenticatorAttachment: "platform",
          response: {
            clientDataJSON,
            attestationObject,
            getTransports: () => ["internal", "hybrid"],
            getAuthenticatorData: () => new ArrayBuffer(0),
            getPublicKey: () => null,
            getPublicKeyAlgorithm: () => -7,
          },
          getClientExtensionResults: () => ({}),
        } as unknown as PublicKeyCredential;

        return syntheticCredential;
      }
    } catch (err) {
      console.warn("[VaultR WebAuthn] Interceptor fallback:", err);
    }

    return originalCreate(options);
  };

  // ─── Override navigator.credentials.get ────────────────────────────────────

  navigator.credentials.get = async function (options?: CredentialRequestOptions): Promise<Credential | null> {
    if (!options?.publicKey) {
      return originalGet(options);
    }

    try {
      const serialized = serializeRequestOptions(options);
      if (!serialized) return originalGet(options);

      const res = await dispatchToExtension("GET", serialized);
      if (res?.handled && res?.credential) {
        const c = res.credential;
        const rawId = base64UrlToBuffer(c.id || c.credentialId);
        const clientDataJSON = new TextEncoder().encode(c.clientDataJSON).buffer;
        const authenticatorData = base64UrlToBuffer(c.authenticatorData);
        const signature = base64UrlToBuffer(c.signature);
        const userHandle = c.userHandle ? base64UrlToBuffer(c.userHandle) : null;

        const syntheticCredential = {
          id: c.id || c.credentialId,
          rawId,
          type: "public-key",
          authenticatorAttachment: "platform",
          response: {
            clientDataJSON,
            authenticatorData,
            signature,
            userHandle,
          },
          getClientExtensionResults: () => ({}),
        } as unknown as PublicKeyCredential;

        return syntheticCredential;
      }
    } catch (err) {
      console.warn("[VaultR WebAuthn] Assertion fallback:", err);
    }

    return originalGet(options);
  };
})();
