/**
 * Resolves avatar image URI for React Native Image component.
 * Converts relative server paths (/api/settings/avatar/...) to full absolute HTTP URLs.
 */
export function getAvatarUri(image?: string | null, serverUrl?: string | null): string | null {
  if (!image) return null;
  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("file://") ||
    image.startsWith("content://") ||
    image.startsWith("data:")
  ) {
    return image;
  }
  const cleanServer = (serverUrl || "http://localhost:3000").replace(/\/+$/, "");
  const cleanPath = image.startsWith("/") ? image : `/${image}`;
  return `${cleanServer}${cleanPath}`;
}
