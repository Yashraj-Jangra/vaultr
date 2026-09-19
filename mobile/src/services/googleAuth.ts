/**
 * Independent Mobile Google Authentication Service (Expo Native Auth)
 *
 * Directly initiates OAuth 2.0 PKCE with Google (accounts.google.com),
 * receives the verified credentials, and exchanges with the VaultR backend API.
 *
 * Eliminates website browser redirects, custom tab web pages, and cookie state mismatches.
 */

import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { toBase64Url } from "@vaultr/core";

export interface AuthProviderConfig {
  googleEnabled: boolean;
  googleClientId?: string;
}

export interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  avatarUrl?: string | null;
}

export interface GoogleAuthResult {
  success: boolean;
  token?: string;
  user?: GoogleAuthUser;
  error?: string;
}

/** Fetch auth provider configuration dynamically from connected VaultR server */
export async function getAuthProviderConfig(serverUrl: string): Promise<AuthProviderConfig> {
  try {
    const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/api/config/auth-providers`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
      },
    });

    if (!res.ok) {
      return { googleEnabled: false };
    }

    const data = await res.json();
    return {
      googleEnabled: Boolean(data?.googleEnabled),
      googleClientId: data?.googleClientId,
    };
  } catch (err) {
    console.warn("[GoogleAuth] Failed to fetch auth-providers config:", err);
    return { googleEnabled: false };
  }
}

/** Parse query parameters and hash fragments from OAuth return URL */
function parseAuthCallbackUrl(url: string): { code?: string; idToken?: string; error?: string } {
  try {
    const queryIdx = url.indexOf("?");
    const hashIdx = url.indexOf("#");

    let queryPart = "";
    if (queryIdx !== -1) {
      queryPart = hashIdx !== -1 && hashIdx > queryIdx
        ? url.substring(queryIdx + 1, hashIdx)
        : url.substring(queryIdx + 1);
    }

    const searchParams = new URLSearchParams(queryPart);
    let code = searchParams.get("code") || undefined;
    let idToken = searchParams.get("id_token") || undefined;
    let error = searchParams.get("error_description") || searchParams.get("error") || undefined;

    if (hashIdx !== -1) {
      const hashParams = new URLSearchParams(url.substring(hashIdx + 1));
      if (!idToken) idToken = hashParams.get("id_token") || undefined;
      if (!code) code = hashParams.get("code") || undefined;
      if (!error) error = hashParams.get("error_description") || hashParams.get("error") || undefined;
    }

    return { code, idToken, error };
  } catch {
    return {};
  }
}

/** Generates cryptographically secure PKCE Code Verifier & Challenge */
async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const randomBytes = Crypto.getRandomBytes(32);
  const codeVerifier = toBase64Url(randomBytes);

  const base64Digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );

  const codeChallenge = base64Digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { codeVerifier, codeChallenge };
}

/**
 * Executes independent native Google Authentication against the server.
 * Connects directly to accounts.google.com and exchanges token with /api/auth/mobile-google.
 */
export async function performNativeGoogleAuth(serverUrl: string): Promise<GoogleAuthResult> {
  const cleanServerUrl = serverUrl.trim().replace(/\/+$/, "");

  // 1. Discover server Google OAuth configuration
  const config = await getAuthProviderConfig(cleanServerUrl);
  if (!config.googleEnabled || !config.googleClientId) {
    return {
      success: false,
      error: "Google Sign-In is not enabled on this VaultR server.",
    };
  }

  // 2. Prepare PKCE and OAuth parameters
  const { codeVerifier, codeChallenge } = await generatePkce();
  const nonceBytes = Crypto.getRandomBytes(16);
  const nonce = toBase64Url(nonceBytes);

  const redirectUri = Linking.createURL("auth-callback");

  const authParams = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    nonce,
    prompt: "select_account",
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

  // 3. Open native Google account picker directly
  let authResult: WebBrowser.WebBrowserAuthSessionResult;
  try {
    authResult = await WebBrowser.openAuthSessionAsync(googleAuthUrl, redirectUri);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to open Google authentication window.",
    };
  }

  if (authResult.type !== "success" || !authResult.url) {
    return {
      success: false,
      error: authResult.type === "cancel" || authResult.type === "dismiss" ? "cancel" : "Google Sign-In was cancelled.",
    };
  }

  // 4. Parse Google response
  const { code, idToken, error } = parseAuthCallbackUrl(authResult.url);
  if (error) {
    return { success: false, error: `Google OAuth error: ${error}` };
  }

  if (!code && !idToken) {
    return { success: false, error: "No authorization token or code received from Google." };
  }

  // 5. Exchange credentials with VaultR backend API directly
  try {
    const exchangePayload = idToken
      ? { idToken }
      : { code, redirectUri, codeVerifier };

    const exchangeRes = await fetch(`${cleanServerUrl}/api/auth/mobile-google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
      },
      body: JSON.stringify(exchangePayload),
    });

    const exchangeData = await exchangeRes.json().catch(() => ({}));
    if (!exchangeRes.ok) {
      return {
        success: false,
        error: exchangeData?.error || "Failed to authenticate with VaultR server.",
      };
    }

    if (!exchangeData?.token || !exchangeData?.user) {
      return {
        success: false,
        error: "Server did not issue a valid authentication session.",
      };
    }

    return {
      success: true,
      token: exchangeData.token,
      user: exchangeData.user,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network error while verifying Google session with server.",
    };
  }
}
