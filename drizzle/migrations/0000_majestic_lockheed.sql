CREATE TABLE "admin_email_templates" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_smtp" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"event" text NOT NULL,
	"session_id" text,
	"ip" text,
	"location" text,
	"device_name" text,
	"email" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "config_site" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_stats" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_entries" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "config_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"published" boolean DEFAULT false,
	"built_in" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"device_name" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"ip_address" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"is_trusted" boolean DEFAULT false,
	"verification_token" text,
	"otp_attempts" integer DEFAULT 0,
	"otp_send_count" integer DEFAULT 0,
	"otp_window_start" timestamp with time zone,
	"otp_sent_at" timestamp with time zone,
	CONSTRAINT "device_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"last_password_changed_at" timestamp with time zone,
	"new_device_email_alert" boolean DEFAULT true,
	"require_verification_on_new" boolean DEFAULT false,
	"clipboard_clear_seconds" integer DEFAULT 0,
	"auto_lock_minutes" integer DEFAULT 15,
	"disabled" boolean DEFAULT false,
	"role" text DEFAULT 'user'
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"encrypted_blob" text NOT NULL,
	"domain" text,
	"folder" text,
	"template" text DEFAULT 'login',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"favorite" boolean DEFAULT false,
	"has_totp" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}'::text[],
	"deleted_at" timestamp with time zone
);
