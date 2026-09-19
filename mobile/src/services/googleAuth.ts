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
  googleIosClientId?: string;
  googleAndroidClientId?: string;
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

export const DEFAULT_GOOGLE_CLIENT_ID = "178311275102-ph0shfc0dhs7cfnefre0q4bue6h0knvp.apps.googleusercontent.com";
export const DEFAULT_GOOGLE_IOS_CLIENT_ID = "178311275102-mev6chejj5km00h2br8ij0m8jig58flr.apps.googleusercontent.com";

/** Fetch auth provider configuration dynamically from connected VaultR server */
export async function getAuthProviderConfig(serverUrl: string): Promise<AuthProviderConfig> {
  const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
  try {
    const res = await fetch(`${cleanUrl}/api/config/auth-providers`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": `VaultrMobile/1.0 (${Platform.OS === "ios" ? "iOS" : "Android"})`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        googleEnabled: data?.googleEnabled !== false,
        googleClientId: data?.googleClientId || DEFAULT_GOOGLE_CLIENT_ID,
        googleIosClientId: data?.googleIosClientId || DEFAULT_GOOGLE_IOS_CLIENT_ID,
        googleAndroidClientId: data?.googleAndroidClientId,
      };
    }

    return {
      googleEnabled: true,
      googleClientId: DEFAULT_GOOGLE_CLIENT_ID,
      googleIosClientId: DEFAULT_GOOGLE_IOS_CLIENT_ID,
    };
  } catch (err) {
    console.warn(`[GoogleAuth] Network error reaching ${cleanUrl}/api/config/auth-providers:`, err);
    return {
      googleEnabled: true,
      googleClientId: DEFAULT_GOOGLE_CLIENT_ID,
      googleIosClientId: DEFAULT_GOOGLE_IOS_CLIENT_ID,
    };
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
function getReversedClientId(clientId: string): string {
  const prefix = clientId.trim().split(".apps.googleusercontent.com")[0];
  return `com.googleusercontent.apps.${prefix}`;
}

/**
 * Normalizes redirect URI to prevent Google's RFC 1918 private IP rejection.
 * Google OAuth strictly blocks private LAN IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * with "device_name and device_id are required for private IP".
 * On Android with ADB reverse (or emulator loopback), rewrites private IP to localhost.
 */
function getSafeGoogleRedirectUri(serverUrl: string): string {
  const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(cleanUrl);
    const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(parsed.hostname);
    if (isPrivateIp) {
      return `http://localhost:${parsed.port || "3000"}/api/auth/mobile-callback`;
    }
  } catch {}
  return `${cleanUrl}/api/auth/mobile-callback`;
}

export async function performNativeGoogleAuth(serverUrl: string): Promise<GoogleAuthResult> {
  const cleanServerUrl = serverUrl.trim().replace(/\/+$/, "");

  // 1. Discover server Google OAuth configuration
  const config = await getAuthProviderConfig(cleanServerUrl);
  const appRedirectUri = Linking.createURL("auth-callback");
  const isExpoGo = appRedirectUri.startsWith("exp://");

  let clientId = config.googleClientId;
  let googleRedirectUri = getSafeGoogleRedirectUri(cleanServerUrl);
  let expectedCallbackUri = appRedirectUri;

  if (Platform.OS === "ios" && config.googleIosClientId) {
    clientId = config.googleIosClientId;
    const reversedScheme = getReversedClientId(config.googleIosClientId);
    googleRedirectUri = `${reversedScheme}:/oauth2redirect`;
    expectedCallbackUri = googleRedirectUri;
  } else if (Platform.OS === "android" && config.googleAndroidClientId && !isExpoGo) {
    clientId = config.googleAndroidClientId;
    googleRedirectUri = appRedirectUri;
    expectedCallbackUri = appRedirectUri;
  }

  if (!config.googleEnabled || !clientId) {
    return {
      success: false,
      error: "Google Sign-In is not enabled or configured on this VaultR server.",
    };
  }

  // 2. Prepare PKCE and OAuth parameters
  const { codeVerifier, codeChallenge } = await generatePkce();
  const nonceBytes = Crypto.getRandomBytes(16);
  const nonce = toBase64Url(nonceBytes);

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri,
    response_type: "code",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    nonce,
    prompt: "select_account",
    ...(expectedCallbackUri !== googleRedirectUri ? { state: expectedCallbackUri } : {}),
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

  // 3. Open native Google account picker directly
  let authResult: WebBrowser.WebBrowserAuthSessionResult;
  try {
    authResult = await WebBrowser.openAuthSessionAsync(googleAuthUrl, expectedCallbackUri);
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
    let resolvedIdToken = idToken;

    // If Google returned authorization code, attempt direct PKCE exchange
    if (!resolvedIdToken && code) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: googleRedirectUri,
          }).toString(),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.id_token) {
            resolvedIdToken = tokenData.id_token;
          }
        }
      } catch {
        // Fall back to server exchange if client token exchange fails
      }
    }

    const exchangePayload = resolvedIdToken
      ? { idToken: resolvedIdToken }
      : { code, redirectUri: googleRedirectUri, codeVerifier };

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
