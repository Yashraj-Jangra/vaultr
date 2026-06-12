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


// ─── User Profiles ────────────────────────────────────────────────────────────
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
  userId: text("userId").notNull().references(() => user.id)
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id),
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
  userId: text("userId").notNull().references(() => user.id)
});

// ─── Support System ───────────────────────────────────────────────────────────

export const supportTickets = pgTable("support_tickets", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:     text("user_id").notNull(),
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
  id:               integer("id").primaryKey().default(1),
  pauseSignups:     boolean("pause_signups").default(false),
  maintenanceMode:  boolean("maintenance_mode").default(false),
  discordWebhook:   text("discord_webhook"),
  backupCron:       text("backup_cron"), // e.g. "0 0 * * *"
});
