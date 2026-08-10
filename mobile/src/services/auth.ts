import * as SecureStore from "expo-secure-store";

const ACCOUNT_TOKEN_KEY = "vaultr_account_token";
const ACCOUNT_USER_KEY = "vaultr_account_user";
const SERVER_URL_KEY = "vaultr_server_url";

export interface AccountUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export async function saveAccountSession(token: string, user: AccountUser, serverUrl: string): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_TOKEN_KEY, token);
  await SecureStore.setItemAsync(ACCOUNT_USER_KEY, JSON.stringify(user));
  await SecureStore.setItemAsync(SERVER_URL_KEY, serverUrl);
}

export async function getSavedAccountSession(): Promise<{ token: string | null; user: AccountUser | null; serverUrl: string | null }> {
  try {
    const token = await SecureStore.getItemAsync(ACCOUNT_TOKEN_KEY);
    const userRaw = await SecureStore.getItemAsync(ACCOUNT_USER_KEY);
    const serverUrl = await SecureStore.getItemAsync(SERVER_URL_KEY);
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user, serverUrl };
  } catch {
    return { token: null, user: null, serverUrl: null };
  }
}

export async function clearAccountSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCOUNT_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCOUNT_USER_KEY);
  } catch {}
}

