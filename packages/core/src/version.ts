/**
 * VaultR 2026 — Universal Versioning & Build Metadata Source of Truth
 * Synchronized across Web App, Browser Extension, Mobile App, and Core Libraries.
 */

export const VAULTR_VERSION = "0.2.7";
export const VAULTR_RELEASE_YEAR = "2026";
export const VAULTR_EDITION = "VaultR 2026";
export const VAULTR_BUILD_NUMBER = "2026.08.18";
export const VAULTR_BUILD_CHANNEL: "stable" | "preview" | "nightly" = "stable";

export const VAULTR_CRYPTO_SPEC = {
  algorithm: "AES-256-GCM",
  kdf: "PBKDF2-SHA-256",
  iterations: 100000,
  ivLengthBytes: 12,
  tagLengthBits: 128,
  keyLengthBits: 256,
  architecture: "Zero-Knowledge Client-Side Encryption",
} as const;

export const VAULTR_OFFICIAL_LINKS = {
  github: "https://github.com",
  docs: "/docs",
  changelog: "/changelog",
  security: "/security",
  privacy: "/privacy",
  terms: "/terms",
  about: "/about",
  support: "/settings/support",
} as const;

/**
 * Returns a human-friendly version string e.g. "VaultR 2026 v0.2.4"
 */
export function getAppVersionString(platform?: "web" | "extension" | "mobile"): string {
  const prefix = platform ? `VaultR ${platform.charAt(0).toUpperCase() + platform.slice(1)}` : VAULTR_EDITION;
  return `${prefix} v${VAULTR_VERSION}`;
}

/**
 * Returns full technical build signature e.g. "VaultR 2026 v0.2.4 (Build 2026.08.16 · Stable)"
 */
export function getBuildSignature(platform?: "web" | "extension" | "mobile"): string {
  const versionStr = getAppVersionString(platform);
  return `${versionStr} (Build ${VAULTR_BUILD_NUMBER} · ${VAULTR_BUILD_CHANNEL.toUpperCase()})`;
}

/**
 * Diagnostic bundle structure for user support and system telemetry
 */
export interface DiagnosticBundle {
  appName: string;
  version: string;
  buildNumber: string;
  channel: string;
  platform: string;
  timestamp: string;
  userAgent?: string;
  cryptoSubtleSupported?: boolean;
  storageEstimateMb?: number;
}
