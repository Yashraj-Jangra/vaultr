import { isWebPageUrl } from "@vaultr/core";

/**
 * Resolves the active web tab whether running inside a toolbar popup or standalone pop-out window.
 */
export async function getActiveWebTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;

  try {
    // 1. If running in a standard toolbar popup, the active tab in currentWindow is the target
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabs[0]?.url && isWebPageUrl(currentTabs[0].url)) {
      return currentTabs[0];
    }

    // 2. If running in a standalone pop-out window, query the active tab in the last-focused normal browser window
    const lastFocused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (lastFocused[0]?.url && isWebPageUrl(lastFocused[0].url)) {
      return lastFocused[0];
    }

    // 3. Fallback: find any active web tab across all normal browser windows
    const allActive = await chrome.tabs.query({ active: true });
    const match = allActive.find((t) => t.url && isWebPageUrl(t.url));
    return match || null;
  } catch {
    return null;
  }
}
