/**
 * src/lib/rateLimit.ts
 *
 * Lightweight, zero-dependency sliding-window rate limiter for Next.js API routes.
 * Tracks request timestamps in memory per key, automatically sweeps expired entries,
 * and produces standard RFC-compliant rate limit headers.
 */

import { NextRequest } from "next/server";

interface RateLimitOptions {
  /** Maximum allowed requests within windowMs */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds when window resets
  retryAfter: number; // Seconds until next permitted request
}

interface WindowBucket {
  timestamps: number[];
  expiresAt: number;
}

const store = new Map<string, WindowBucket>();

// Periodic garbage collection to prevent memory leaks from inactive keys
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of store.entries()) {
    if (bucket.expiresAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Extracts the best candidate client IP address from request headers.
 */
export function getClientIp(req: NextRequest | Headers): string {
  const headers = req instanceof Headers ? req : req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

/**
 * Checks and records a rate limit hit for the given key using a sliding window.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const windowStart = now - options.windowMs;

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [], expiresAt: now + options.windowMs };
    store.set(key, bucket);
  }

  // Filter timestamps outside current window
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);
  bucket.expiresAt = now + options.windowMs;

  const count = bucket.timestamps.length;
  const remaining = Math.max(0, options.limit - count);
  const oldestTimestamp = bucket.timestamps[0] ?? now;
  const resetMs = oldestTimestamp + options.windowMs;
  const resetSeconds = Math.ceil(resetMs / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - now) / 1000));

  if (count >= options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      reset: resetSeconds,
      retryAfter: retryAfterSeconds,
    };
  }

  // Record this hit
  bucket.timestamps.push(now);

  return {
    success: true,
    limit: options.limit,
    remaining: remaining - 1,
    reset: resetSeconds,
    retryAfter: 0,
  };
}

/**
 * Formats rate limit result into standard response headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.reset),
  };
  if (!result.success) {
    headers["Retry-After"] = String(result.retryAfter);
  }
  return headers;
}
