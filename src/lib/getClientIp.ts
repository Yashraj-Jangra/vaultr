/**
 * src/lib/getClientIp.ts
 *
 * Extracts and sanitizes the client IP address from a Next.js request.
 *
 * Rules:
 * - Prefers x-real-ip (set by nginx/Caddy for the true client IP)
 * - Falls back to the first entry in x-forwarded-for (leftmost = original client)
 * - Validates the result against a strict IPv4/IPv6 pattern to prevent log injection
 * - Returns undefined if no valid IP is found
 */

import { NextRequest } from "next/server";

// Matches standard IPv4 and IPv6 addresses (including IPv4-mapped IPv6)
const IP_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

export function getClientIp(req: NextRequest): string | undefined {
  // Prefer x-real-ip — set by trusted reverse proxies to the true client IP
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && IP_PATTERN.test(realIp)) return realIp;

  // Fall back to leftmost entry in x-forwarded-for
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first && IP_PATTERN.test(first)) return first;
  }

  return undefined;
}
