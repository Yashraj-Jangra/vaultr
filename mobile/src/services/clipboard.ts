/**
 * Mobile Clipboard Service with Automatic Security Clearing
 * Respects user's configured auto-clear timeout (30s / 60s / never).
 */

import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLIPBOARD_TIMEOUT_KEY = "vaultr_clipboard_clear_timeout";

let activeClearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedText: string | null = null;

/**
 * Copies text to system clipboard and schedules automatic clearing if configured.
 * @param text The sensitive text to copy (password, TOTP, username, note, etc.)
 */
export async function copyToClipboardWithAutoClear(text: string): Promise<void> {
  if (text === undefined || text === null) return;

  // Clear previous timer if any
  if (activeClearTimer) {
    clearTimeout(activeClearTimer);
    activeClearTimer = null;
  }

  await Clipboard.setStringAsync(text);
  lastCopiedText = text;

  try {
    const rawTimeout = await AsyncStorage.getItem(CLIPBOARD_TIMEOUT_KEY);
    const timeoutSeconds = parseInt(rawTimeout || "30", 10);

    // If timeout > 0, schedule auto-clear
    if (!isNaN(timeoutSeconds) && timeoutSeconds > 0) {
      activeClearTimer = setTimeout(async () => {
        try {
          const currentContent = await Clipboard.getStringAsync();
          // Only clear if the user hasn't copied something else in the meantime
          if (currentContent === lastCopiedText) {
            await Clipboard.setStringAsync("");
            lastCopiedText = null;
          }
        } catch {
          // ignore
        }
      }, timeoutSeconds * 1000);
    }
  } catch {
    // ignore storage reading errors
  }
}
