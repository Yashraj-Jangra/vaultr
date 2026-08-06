/**
 * src/proxy.ts
 *
 * Next.js Proxy — runs before every request.
 *
 * Responsibilities:
 *  1. In-memory per-IP rate limiting for API routes
 *
 * Rate limit store resets on server restart. For multi-process/edge deployments,
 * replace with an Upstash Redis store.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/getClientIp";

// ── Rate limit store ──────────────────────────────────────────────────────────
// Map<ip, Map<bucket, { count: number; resetAt: number }>>
// Using a module-level Map (persists for the lifetime of the Node.js process).

interface BucketState {
  count: number;
  resetAt: number; // Unix ms timestamp
}

const store = new Map<string, Map<string, BucketState>>();

// ── Bucket definitions ────────────────────────────────────────────────────────
interface RateLimitRule {
  /** Unique name for this bucket */
  bucket: string;
  /** Max requests allowed within the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** URL path prefix this rule applies to */
  prefix: string;
}

const RULES: RateLimitRule[] = [
  // Auth endpoints: tightest limits to prevent brute-force + credential stuffing
  {
    bucket: "auth",
    prefix: "/api/auth/sign-in",
    max: 10,
    windowMs: 15 * 60 * 1000, // 10 attempts per 15 min
  },
  {
    bucket: "signup",
    prefix: "/api/auth/sign-up",
    max: 5,
    windowMs: 60 * 60 * 1000, // 5 signups per hour
  },
  // OTP / 2FA: very strict
  {
    bucket: "otp",
    prefix: "/api/auth/two-factor",
    max: 5,
    windowMs: 10 * 60 * 1000, // 5 attempts per 10 min
  },
  // Stream SSE endpoint: separate bucket so SSE reconnects don't exhaust general API quota
  {
    bucket: "stream",
    prefix: "/api/vault/stream",
    max: 30,
    windowMs: 60 * 1000, // 30 connections per min
  },
  // Vault item reads: dedicated bucket so item fetches are isolated
  {
    bucket: "vault-read",
    prefix: "/api/vault/items",
    max: 60,
    windowMs: 60 * 1000, // 60 req/min
  },
  // General API: generous but bounded
  {
    bucket: "api",
    prefix: "/api/",
    max: 120,
    windowMs: 60 * 1000, // 120 req/min
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBucketState(ip: string, bucket: string): BucketState {
  if (!store.has(ip)) store.set(ip, new Map());
  const ipBuckets = store.get(ip)!;

  const now = Date.now();
  let state = ipBuckets.get(bucket);

  if (!state || now >= state.resetAt) {
    // Initialise or reset expired window
    state = { count: 0, resetAt: now + getWindowMs(bucket) };
    ipBuckets.set(bucket, state);
  }

  return state;
}

function getWindowMs(bucket: string): number {
  return RULES.find((r) => r.bucket === bucket)?.windowMs ?? 60_000;
}

function checkRateLimit(
  ip: string,
  rule: RateLimitRule
): { allowed: boolean; remaining: number; resetAt: number } {
  const state = getBucketState(ip, rule.bucket);
  state.count += 1;

  const remaining = Math.max(0, rule.max - state.count);
  return {
    allowed: state.count <= rule.max,
    remaining,
    resetAt: state.resetAt,
  };
}

// Periodically prune stale entries to prevent unbounded memory growth
// (runs every 10 minutes, removes IPs whose all buckets have expired)
let lastPruned = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPruned < 10 * 60 * 1000) return;
  lastPruned = now;

  for (const [ip, buckets] of store.entries()) {
    let allExpired = true;
    for (const state of buckets.values()) {
      if (now < state.resetAt) { allExpired = false; break; }
    }
    if (allExpired) store.delete(ip);
  }
}

// ── Proxy Function ───────────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  maybePrune();

  // Resolve client IP — fall back to a fixed key if unknown (avoids undefined bypass)
  const ip = getClientIp(req) ?? "unknown";

  // Find the most-specific matching rule (longest prefix wins)
  const matchingRules = RULES.filter((r) => pathname.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  );

  for (const rule of matchingRules) {
    const { allowed, remaining, resetAt } = checkRateLimit(ip, rule);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests — please slow down and try again later.",
          retryAfterSeconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(rule.max),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
  ],
};
