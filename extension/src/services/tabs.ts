import { isWebPageUrl } from "@vaultr/core";

/**
 * Resolves the active web tab whether running inside a toolbar popup or standalone pop-out window.
 */
export async function getActiveWebTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;

  try {
    // 0. If a tabId was explicitly passed via URL search parameters (e.g. popup.html?mode=popout&tabId=123)
    if (typeof window !== "undefined") {
      const urlTabId = new URLSearchParams(window.location.search).get("tabId");
      if (urlTabId) {
        try {
          const tab = await chrome.tabs.get(Number(urlTabId));
          if (tab?.id && tab.url && isWebPageUrl(tab.url)) {
            return tab;
          }
        } catch {}
      }
    }

    // 1. If running in a standard toolbar popup, the active tab in currentWindow is the target
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabs[0]?.url && isWebPageUrl(currentTabs[0].url)) {
      return currentTabs[0];
    }

    // 2. If running in a standalone pop-out window, query the last focused NORMAL browser window.
    // Specifying windowTypes: ["normal"] ensures Chrome ignores the popout window itself!
    if (typeof chrome.windows !== "undefined" && chrome.windows.getLastFocused) {
      try {
        const lastNormalWin = await chrome.windows.getLastFocused({
          windowTypes: ["normal"],
          populate: true,
        });
        if (lastNormalWin?.tabs) {
          const activeTab = lastNormalWin.tabs.find((t) => t.active && t.url && isWebPageUrl(t.url));
          if (activeTab) return activeTab;
        }
      } catch {}
    }

    // 3. Fallback: Search all normal browser windows for their active web tab
    if (typeof chrome.windows !== "undefined" && chrome.windows.getAll) {
      try {
        const normalWindows = await chrome.windows.getAll({
          windowTypes: ["normal"],
          populate: true,
        });
        for (const win of normalWindows) {
          if (win.tabs) {
            const activeTab = win.tabs.find((t) => t.active && t.url && isWebPageUrl(t.url));
            if (activeTab) return activeTab;
          }
        }
      } catch {}
    }

    // 4. Fallback: find any active web tab across all windows
    const allActive = await chrome.tabs.query({ active: true });
    const match = allActive.find((t) => t.url && isWebPageUrl(t.url));
    if (match) return match;

    // 5. Final fallback: find any tab across the browser with a valid web URL
    const allTabs = await chrome.tabs.query({});
    const fallback = allTabs.find((t) => t.url && isWebPageUrl(t.url));
    return fallback || null;
  } catch {
    return null;
  }
}
