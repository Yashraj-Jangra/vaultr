/**
 * Resolves avatar image URI for React Native Image component.
 * Converts relative server paths (/api/settings/avatar/... or /api/avatars/...) to full absolute HTTP URLs.
 * Handles Android Emulator localhost -> 10.0.2.2 loopback mapping.
 */
import { Platform } from "react-native";

export function getAvatarUri(image?: string | null, serverUrl?: string | null): string | null {
  if (!image || typeof image !== "string" || !image.trim()) return null;

  const trimmed = image.trim();

  // Local device URIs or Base64 data URIs
  if (
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  // External provider avatars (e.g. Google user profile photos)
  if (
    trimmed.includes("googleusercontent.com") ||
    trimmed.includes("gravatar.com") ||
    trimmed.includes("githubusercontent.com")
  ) {
    return trimmed;
  }

  let cleanServer = (serverUrl || "https://vaultr.cvweb.qzz.io").replace(/\/+$/, "");
  if (Platform.OS === "android") {
    cleanServer = cleanServer.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }

  // If it contains the app's proxy path (/api/avatars/...)
  if (trimmed.includes("/api/avatars/")) {
    const match = trimmed.match(/\/api\/avatars\/(.+)$/);
    if (match) {
      return `${cleanServer}/api/avatars/${match[1]}`;
    }
  }

  // If it contains MinIO / S3 direct avatars bucket path (/avatars/...)
  if (trimmed.includes("/avatars/")) {
    const match = trimmed.match(/\/avatars\/(.+)$/);
    if (match) {
      return `${cleanServer}/api/avatars/${match[1]}`;
    }
  }

  // If it's already an absolute external HTTP/HTTPS URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (Platform.OS === "android") {
      return trimmed.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
    }
    return trimmed;
  }

  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${cleanServer}${cleanPath}`;
}
