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

// ─── Better Auth Tables ───────────────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
  twoFactorEnabled: boolean("twoFactorEnabled")
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt")
});

export const twoFactor = pgTable("twoFactor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: 'cascade' })
});

// ─── Vault Items ──────────────────────────────────────────────────────────────
// Each row holds one AES-256-GCM encrypted credential blob. The encrypted_blob
// field is opaque to the server — only the client can decrypt it with the master key.

export const vaultItems = pgTable("vault_items", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:         text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
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

// ─── Vault Attachments ────────────────────────────────────────────────────────
// One encrypted file per row. The file content is AES-GCM encrypted client-side
// before upload — the server stores an opaque blob and never sees plaintext.
// The filename is also encrypted; only mimeType is stored in clear.

export const vaultAttachments = pgTable("vault_attachments", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultItemId:   uuid("vault_item_id").notNull()
                   .references(() => vaultItems.id, { onDelete: "cascade" }),
  userId:        text("user_id").notNull()
                   .references(() => user.id, { onDelete: "cascade" }),
  // Encrypted original filename — only the vault owner can decrypt this
  encryptedName: text("encrypted_name").notNull(),
  // Clear MIME type — reveals format but not content (acceptable)
  mimeType:      text("mime_type").notNull().default("application/octet-stream"),
  // Size of the encrypted blob in bytes (slightly > original due to IV + GCM tag)
  sizeBytes:     integer("size_bytes").notNull(),
  // S3/MinIO object key in the attachments bucket
  s3Key:         text("s3_key").notNull().unique(),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type VaultAttachment    = typeof vaultAttachments.$inferSelect;
export type NewVaultAttachment = typeof vaultAttachments.$inferInsert;

// ─── User Profiles ────────────────────────────────────────────────────────────
// Extends Better Auth's own user record with app-specific fields.

export const userProfiles = pgTable("user_profiles", {
  userId:                   text("user_id").primaryKey().references(() => user.id, { onDelete: 'cascade' }),
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
  deletedByAdmin:           timestamp("deleted_by_admin", { withTimezone: true }),
  deletedByAdminId:         text("deleted_by_admin_id"),
  customFolders:            text("custom_folders").array().default(sql`'{}'::text[]`),
  // ── Storage ──────────────────────────────────────────────────────────────
  storageUsedBytes:         integer("storage_used_bytes").default(0),
  storageQuotaBytes:        integer("storage_quota_bytes").default(104857600), // 100 MB
  // ── Cooldowns & Deletion ──────────────────────────────────────────────────
  scheduledDeleteAt:        timestamp("scheduled_delete_at", { withTimezone: true }),
});

export type UserProfile    = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// ─── Config: Site Settings ────────────────────────────────────────────────────
// Singleton row (id = 1 always). Stores site name, logo, etc.

export const configSite = pgTable("config_site", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Config: Themes ───────────────────────────────────────────────────────────

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
// Singleton row (id = 1). Stores aggregate counters like total vault entries.

export const configStats = pgTable("config_stats", {
  id:           integer("id").primaryKey().default(1),
  totalEntries: integer("total_entries").default(0),
});

// ─── Admin: SMTP Settings ─────────────────────────────────────────────────────
// Singleton row (id = 1). Written only by admin, read server-side for email sending.

export const adminSmtp = pgTable("admin_smtp", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Admin: Email Templates ───────────────────────────────────────────────────
// Singleton row (id = 1). Custom HTML per email type.

export const adminEmailTemplates = pgTable("admin_email_templates", {
  id:   integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
// Append-only security event log. Never update or delete rows.

export const auditLogs = pgTable("audit_logs", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:     text("user_id").references(() => user.id, { onDelete: 'set null' }),
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

// ─── Support System ───────────────────────────────────────────────────────────

export const supportTickets = pgTable("support_tickets", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:     text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  subject:    text("subject").notNull(),
  status:     text("status").default("open"), // open, pending, resolved, closed
  priority:   text("priority").default("normal"), // low, normal, high, urgent
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }),
});

export type SupportTicket    = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;

export const ticketMessages = pgTable("ticket_messages", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId:   uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderId:   text("sender_id").notNull(), // userId of sender, or "SYSTEM"
  message:    text("message").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type TicketMessage    = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;

// ─── Email Logs ───────────────────────────────────────────────────────────────

export const emailLogs = pgTable("email_logs", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  recipient:  text("recipient").notNull(),
  subject:    text("subject").notNull(),
  status:     text("status").notNull(), // sent, failed
  error:      text("error"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Config: System Operations ────────────────────────────────────────────────

export const configSystem = pgTable("config_system", {
  id:                       integer("id").primaryKey().default(1),
  pauseSignups:             boolean("pause_signups").default(false),
  maintenanceMode:          boolean("maintenance_mode").default(false),
  discordWebhook:           text("discord_webhook"),
  backupCron:               text("backup_cron"), // e.g. "0 0 * * *"
  requireEmailVerification: boolean("require_email_verification").default(false),
});

// ─── Session Meta ──────────────────────────────────────────────────────────────
// Shadow table we fully own. Better Auth's session table is the source of truth —
// this adds device name, parsed UA, geo-data, and last-active tracking per session.
// Cascade-deletes when the session is revoked in Better Auth's session table.

export const sessionMeta = pgTable("session_meta", {
  sessionId:    text("session_id").primaryKey()
                  .references(() => session.id, { onDelete: "cascade" }),
  userId:       text("user_id").notNull()
                  .references(() => user.id,    { onDelete: "cascade" }),
  deviceName:   text("device_name"),   // e.g. "Chrome 125 on Windows 11"
  browser:      text("browser"),       // e.g. "Chrome 125"
  os:           text("os"),            // e.g. "Windows 11"
  ipAddress:    text("ip_address"),    // real client IP
  country:      text("country"),       // from ip-api.com
  city:         text("city"),          // from ip-api.com
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
  createdAt:    timestamp("created_at",     { withTimezone: true }).defaultNow(),
});

export type SessionMeta    = typeof sessionMeta.$inferSelect;
export type NewSessionMeta = typeof sessionMeta.$inferInsert;

