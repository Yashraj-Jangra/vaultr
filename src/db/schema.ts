/**
 * src/db/schema.ts
 *
 * Single source of truth for all database tables.
 * Edit this file, then run:  npm run db:generate  →  npm run db:migrate
 *
 * Naming: snake_case in Postgres, camelCase in TypeScript (Drizzle handles mapping)
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Vault Items ──────────────────────────────────────────────────────────────
// Replaces: Firestore  users/{uid}/vaultItems/{id}
// Each row holds one AES-256-GCM encrypted credential blob. The encrypted_blob
// field is opaque to the server — only the client can decrypt it with the master key.

export const vaultItems = pgTable("vault_items", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:         text("user_id").notNull(),
  name:           text("name").notNull(),
  encryptedBlob:  text("encrypted_blob").notNull(),
  domain:         text("domain"),
  folder:         text("folder"),
  template:       text("template").default("login"),  // login | card | address | profile | note
  createdAt:      timestamp("created_at",      { withTimezone: true }).defaultNow(),
  updatedAt:      timestamp("updated_at",      { withTimezone: true }),
  lastAccessedAt: timestamp("last_accessed_at",{ withTimezone: true }),
  favorite:       boolean("favorite").default(false),
  hasTotp:        boolean("has_totp").default(false),
  tags:           text("tags").array().default(sql`'{}'::text[]`),
  deletedAt:      timestamp("deleted_at",      { withTimezone: true }),
});

export type VaultItem    = typeof vaultItems.$inferSelect;
export type NewVaultItem = typeof vaultItems.$inferInsert;

// ─── Device Sessions ──────────────────────────────────────────────────────────
// Replaces: Firestore  users/{uid}/sessions/{sessionId}
// Tracks active device sessions, OTP verification, and trust status.
// Note: These are _vaultr device sessions, separate from Better Auth's own sessions.

export const deviceSessions = pgTable("device_sessions", {
  id:                uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId:         text("session_id").unique().notNull(),  // UUID from localStorage
  userId:            text("user_id").notNull(),
  deviceName:        text("device_name"),
  deviceType:        text("device_type"),
  browser:           text("browser"),
  os:                text("os"),
  ipAddress:         text("ip_address"),
  location:          text("location"),
  createdAt:         timestamp("created_at",       { withTimezone: true }).defaultNow(),
  lastSeenAt:        timestamp("last_seen_at",      { withTimezone: true }).defaultNow(),
  isTrusted:         boolean("is_trusted").default(false),
  verificationToken: text("verification_token"),        // SHA-256 hash of OTP
  otpAttempts:       integer("otp_attempts").default(0),
  otpSendCount:      integer("otp_send_count").default(0),
  otpWindowStart:    timestamp("otp_window_start",  { withTimezone: true }),
  otpSentAt:         timestamp("otp_sent_at",        { withTimezone: true }),
});

export type DeviceSession    = typeof deviceSessions.$inferSelect;
export type NewDeviceSession = typeof deviceSessions.$inferInsert;

// ─── User Profiles ────────────────────────────────────────────────────────────
// Replaces: Firestore  users/{uid}/profile/personal  +  users/{uid}/profile/security
// Extends Better Auth's own user record with app-specific fields.

export const userProfiles = pgTable("user_profiles", {
  userId:                   text("user_id").primaryKey(),
  displayName:              text("display_name"),
  avatarUrl:                text("avatar_url"),
  firstName:                text("first_name"),
  lastName:                 text("last_name"),
  phone:                    text("phone"),
  lastPasswordChangedAt:    timestamp("last_password_changed_at", { withTimezone: true }),
  newDeviceEmailAlert:      boolean("new_device_email_alert").default(true),
  requireVerificationOnNew: boolean("require_verification_on_new").default(false),
  clipboardClearSeconds:    integer("clipboard_clear_seconds").default(0),
  autoLockMinutes:          integer("auto_lock_minutes").default(15),
  disabled:                 boolean("disabled").default(false),
  role:                     text("role").default("user"),  // "user" | "admin"
});

export type UserProfile    = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// ─── Config: Site Settings ────────────────────────────────────────────────────
// Replaces: Firestore  config/site
// Singleton row (id = 1 always). Stores site name, logo, etc.

export const configSite = pgTable("config_site", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Config: Themes ───────────────────────────────────────────────────────────
// Replaces: Firestore  config/themes/list/{id}

export const configThemes = pgTable("config_themes", {
  id:        text("id").primaryKey(),
  data:      jsonb("data").notNull(),
  published: boolean("published").default(false),
  builtIn:   boolean("built_in").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ConfigTheme    = typeof configThemes.$inferSelect;
export type NewConfigTheme = typeof configThemes.$inferInsert;

// ─── Config: Stats ────────────────────────────────────────────────────────────
// Replaces: Firestore  config/stats
// Singleton row (id = 1). Stores aggregate counters like total vault entries.

export const configStats = pgTable("config_stats", {
  id:           integer("id").primaryKey().default(1),
  totalEntries: integer("total_entries").default(0),
});

// ─── Admin: SMTP Settings ─────────────────────────────────────────────────────
// Replaces: Firestore  adminSettings/smtp
// Singleton row (id = 1). Written only by admin, read server-side for email sending.

export const adminSmtp = pgTable("admin_smtp", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Admin: Email Templates ───────────────────────────────────────────────────
// Replaces: Firestore  adminSettings/emailTemplates
// Singleton row (id = 1). Custom HTML per email type.

export const adminEmailTemplates = pgTable("admin_email_templates", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
// Append-only security event log. Never update or delete rows.

export const auditLogs = pgTable("audit_logs", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:     text("user_id"),
  event:      text("event").notNull(),
  sessionId:  text("session_id"),
  ip:         text("ip"),
  location:   text("location"),
  deviceName: text("device_name"),
  email:      text("email"),
  meta:       jsonb("meta").default({}),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
