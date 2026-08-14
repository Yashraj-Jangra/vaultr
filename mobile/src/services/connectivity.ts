/**
 * Mobile Connectivity & Health Probe Service
 * Provides lightweight network availability checks with zero external dependencies.
 */

import { AppState, AppStateStatus } from "react-native";

export async function probeServerConnection(serverUrl: string): Promise<boolean> {
  if (!serverUrl) return false;
  try {
    const cleanUrl = serverUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    // Try pinging the server health endpoint or base URL
    const response = await fetch(`${cleanUrl}/api/auth/session`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    }).catch(async () => {
      // Fallback probe to generic 204 endpoint if server url had DNS or SSL issue
      return await fetch("https://clients3.google.com/generate_204", {
        method: "HEAD",
        signal: controller.signal,
      });
    });

    clearTimeout(timer);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Connectivity Monitor that triggers onReconnected callback when returning to foreground or network restored.
 */
export function startConnectivityMonitor(
  getServerUrl: () => string,
  onStatusChange: (isOnline: boolean) => void,
  onReconnected?: () => void
): () => void {
  let wasOnline = true;
  let intervalId: any = null;

  async function check() {
    const online = await probeServerConnection(getServerUrl());
    if (online !== wasOnline) {
      wasOnline = online;
      onStatusChange(online);
      if (online && onReconnected) {
        onReconnected();
      }
    }
  }

  // AppState foreground listener
  const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
    if (status === "active") {
      check();
    }
  });

  // Interval check (every 15 seconds)
  intervalId = setInterval(check, 15000);

  // Initial check
  check();

  return () => {
    subscription.remove();
    if (intervalId) clearInterval(intervalId);
  };
}
