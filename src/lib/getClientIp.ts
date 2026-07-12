/**
 * src/lib/getClientIp.ts
 *
 * Extracts and sanitizes the client IP address from a Next.js request.
 *
 * ── Trust model for NAT / reverse-proxy deployments ──────────────────────────
 * This server runs behind a NAT with Traefik as the reverse proxy.
 * Traefik sets `X-Forwarded-For` to the real client IP before forwarding
 * the request — confirmed via traefik/whoami.
 *
 * Header priority (most-to-least reliable in this setup):
 *  1. X-Forwarded-For  — set by Traefik with the real client IP
 *  2. X-Real-IP        — set by some nginx configs (not present in Traefik by default)
 *
 * Security note on X-Forwarded-For spoofing:
 *  A client could send a fake `X-Forwarded-For` header before hitting Traefik.
 *  Traefik in its default config *prepends* the real remote address, so the
 *  format becomes:  `<real-ip>, <spoofed-header-from-client>` — NOT the reverse.
 *  Taking the *first* entry is therefore safe when Traefik is trusted and is the
 *  only ingress. If using `--entryPoints.web.forwardedHeaders.trustedIPs` in
 *  Traefik, the header is fully sanitised before reaching us.
 *
 * Returns undefined only if no valid IP is found — callers should fall back to
 * a fixed sentinel key (e.g. "unknown") rather than skipping rate limiting.
 */

import { NextRequest } from "next/server";

/**
 * Matches standard IPv4 and a broad set of IPv6 address formats.
 * Deliberately permissive for IPv6 (we validate structure, not every edge case)
 * to avoid wrongly rejecting valid addresses from proxies.
 */
const IPv4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

// Covers full, compressed, loopback, and IPv4-mapped IPv6 (::ffff:x.x.x.x)
const IPv6_PATTERN =
  /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::(?:ffff(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1\d|\d)\d|\d)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isValidIp(ip: string): boolean {
  return IPv4_PATTERN.test(ip) || IPv6_PATTERN.test(ip);
}

/**
 * Extracts the first (leftmost) IP from a comma-separated X-Forwarded-For value.
 * Traefik prepends the real client IP, making it the leftmost entry.
 */
function firstFromForwarded(header: string): string | undefined {
  const first = header.split(",")[0].trim();
  return first && isValidIp(first) ? first : undefined;
}

export function getClientIp(req: NextRequest): string | undefined {
  // ── 1. X-Forwarded-For ───────────────────────────────────────────────────
  // Primary source in this NAT/Traefik setup (verified via traefik/whoami).
  // Traefik prepends the real client IP as the leftmost entry.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = firstFromForwarded(forwarded);
    if (ip) return ip;
  }

  // ── 2. X-Real-IP ──────────────────────────────────────────────────────────
  // Set by some nginx configurations; not present in Traefik by default.
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  // ── 3. No usable IP found ─────────────────────────────────────────────────
  return undefined;
}
