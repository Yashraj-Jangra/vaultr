/**
 * src/lib/auditLog.ts
 *
 * Server-side-only audit logger.
 * Appends structured JSONL entries to logs/security/YYYY-MM-DD.jsonl.
 * One file per calendar day; reads are served by /api/admin/logs.
 *
 * Rules:
 *  - Never throws — a logging failure must never block an auth flow.
 *  - Uses appendFileSync (safe for concurrent Next.js route handler calls
 *    inside a single Node.js process; each syscall is atomic on POSIX).
 *  - ensureDir is idempotent and cached after first success.
 */

import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { sendDiscordWebhook } from "./webhook";

// ─── Event catalogue ─────────────────────────────────────────────────────────

export type AuditEventKey =
  | "session.created"
  | "session.auto_verify_sent"
  | "session.auto_verify_skipped"
  | "session.alert_sent"
  | "session.first_device"
  | "session.revoked"
  | "session.revoked_other"
  | "session.revoke_all"
  | "device.verified"
  | "device.verify_failed"
  | "device.verify_locked"
  | "device.verify_expired"
  | "otp.sent"
  | "otp.rate_limited"
  | "email.sent"
  | "email.failed"
  | "email.broadcast"
  | "admin.record.updated"
  | "admin.record.deleted"
  | "admin.integrity.fixed";

// ─── Entry shape ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  /** ISO-8601 timestamp */
  ts?: string;
  /** Event identifier */
  event: AuditEventKey;
  /** User ID of the subject user */
  uid: string;
  /** Session document ID (when relevant) */
  sessionId?: string;
  /** Resolved client IP */
  ip?: string;
  /** Geo-IP location string ("City, Country") */
  location?: string;
  /** Human-readable device name ("Chrome on Windows") */
  deviceName?: string;
  /** User email (resolved from token or Auth record) */
  email?: string;
  /** Arbitrary extra fields — kept out of top-level to avoid ambiguity */
  meta?: Record<string, unknown>;
}

// ─── Internals ────────────────────────────────────────────────────────────────

const LOG_DIR = join(process.cwd(), "logs", "security");

/** Set to true once we've successfully created the directory. */
let _dirReady = false;

function ensureDir(): void {
  if (_dirReady) return;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    _dirReady = true;
  } catch {
    // mkdirSync throws if the path is a file or permissions are denied.
    // We silently swallow — callers must never blow up due to logging.
  }
}

function todayPath(): string {
  const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return join(LOG_DIR, `${date}.jsonl`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a security audit entry to today's log file.
 *
 * @example
 * auditLog({ event: "session.created", uid, sessionId, ip, location, deviceName });
 */
export function auditLog(entry: AuditLogEntry): void {
  try {
    ensureDir();
    const line =
      JSON.stringify({
        ...entry,
        // Guarantee ts is always set even if caller forgets
        ts: entry.ts ?? new Date().toISOString(),
      }) + "\n";
    appendFileSync(todayPath(), line, "utf8");

    // Async webhook dispatch for critical alerts
    const criticalEvents: AuditEventKey[] = ["session.revoke_all", "session.revoked_other", "device.verify_locked", "email.broadcast"];
    if (criticalEvents.includes(entry.event)) {
      sendDiscordWebhook(
        "Critical Audit Event", 
        `**Event:** ${entry.event}\n**User ID:** ${entry.uid}\n**IP:** ${entry.ip || 'Unknown'}\n**Device:** ${entry.deviceName || 'Unknown'}`,
        0xff0000
      ).catch(e => console.error("Failed to dispatch audit webhook", e));
    }
  } catch {
    // Never propagate — logging errors are silently dropped.
  }
}
