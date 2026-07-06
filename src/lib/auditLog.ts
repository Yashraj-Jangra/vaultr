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

// ─── Webhook Meta ─────────────────────────────────────────────────────────────

interface WebhookMeta {
  emoji: string;
  color: number;
  label: string;
}

const WEBHOOK_META: Record<AuditEventKey, WebhookMeta> = {
  "session.created":            { emoji: "🔑", color: 0x3498db, label: "Session Created" },
  "session.auto_verify_sent":   { emoji: "📧", color: 0x3498db, label: "Auto-Verify Sent" },
  "session.auto_verify_skipped":{ emoji: "⚠️", color: 0xf1c40f, label: "Auto-Verify Skipped" },
  "session.alert_sent":         { emoji: "🚨", color: 0xe67e22, label: "New-Device Alert Sent" },
  "session.first_device":       { emoji: "📱", color: 0x3498db, label: "First Device Enrolled" },
  "session.revoked":            { emoji: "🚪", color: 0xe67e22, label: "Session Revoked" },
  "session.revoked_other":      { emoji: "🛑", color: 0xe74c3c, label: "Remote Session Revoked" },
  "session.revoke_all":         { emoji: "💥", color: 0x9b59b6, label: "All Sessions Revoked" },
  "device.verified":            { emoji: "✅", color: 0x2ecc71, label: "Device Verified" },
  "device.verify_failed":       { emoji: "❌", color: 0xe67e22, label: "Device Verification Failed" },
  "device.verify_locked":       { emoji: "🔒", color: 0xe74c3c, label: "Device Verification Locked" },
  "device.verify_expired":      { emoji: "⏳", color: 0x95a5a6, label: "Verification Code Expired" },
  "otp.sent":                   { emoji: "🔢", color: 0x3498db, label: "OTP Code Sent" },
  "otp.rate_limited":           { emoji: "⏱️", color: 0xf1c40f, label: "OTP Rate-Limited" },
  "email.sent":                 { emoji: "📤", color: 0x2ecc71, label: "System Email Sent" },
  "email.failed":               { emoji: "🔥", color: 0xe74c3c, label: "System Email Failed" },
  "email.broadcast":            { emoji: "📢", color: 0x9b59b6, label: "System Email Broadcasted" },
  "admin.record.updated":       { emoji: "✏️", color: 0x3498db, label: "Admin Record Updated" },
  "admin.record.deleted":       { emoji: "🗑️", color: 0xe74c3c, label: "Admin Record Deleted" },
  "admin.integrity.fixed":      { emoji: "🛠️", color: 0x2ecc71, label: "Database Integrity Restored" },
};

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

    // Rich Discord webhook dispatch for all events
    const meta = WEBHOOK_META[entry.event];
    if (meta) {
      const title = `${meta.emoji} ${meta.label}`;
      const description = `A security audit event was logged on the server.`;
      
      const fields = [
        { name: "Event Key", value: `\`${entry.event}\``, inline: true },
        { name: "User ID", value: entry.uid ? `\`${entry.uid}\`` : "N/A", inline: true },
        ...(entry.email ? [{ name: "Email", value: entry.email, inline: true }] : []),
        ...(entry.ip ? [{ name: "IP Address", value: entry.ip, inline: true }] : []),
        ...(entry.location ? [{ name: "Location", value: entry.location, inline: true }] : []),
        ...(entry.deviceName ? [{ name: "Device", value: entry.deviceName, inline: true }] : []),
        ...(entry.sessionId ? [{ name: "Session ID", value: `\`${entry.sessionId}\``, inline: false }] : []),
      ];

      sendDiscordWebhook(title, description, meta.color, fields).catch(e => 
        console.error("Failed to dispatch audit webhook", e)
      );
    }
  } catch {
    // Never propagate — logging errors are silently dropped.
  }
}
