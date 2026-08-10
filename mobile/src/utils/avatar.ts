/**
 * Resolves avatar image URI for React Native Image component.
 * Converts relative server paths (/api/settings/avatar/...) to full absolute HTTP URLs.
 * Handles Android Emulator localhost -> 10.0.2.2 loopback mapping.
 */
import { Platform } from "react-native";

export function getAvatarUri(image?: string | null, serverUrl?: string | null): string | null {
  if (!image) return null;

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("file://") ||
    image.startsWith("content://") ||
    image.startsWith("data:")
  ) {
    if (Platform.OS === "android") {
      return image.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
    }
    return image;
  }

  let cleanServer = (serverUrl || "https://vaultr.cvweb.qzz.io").replace(/\/+$/, "");
  if (Platform.OS === "android") {
    cleanServer = cleanServer.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }

  const cleanPath = image.startsWith("/") ? image : `/${image}`;
  return `${cleanServer}${cleanPath}`;
}
