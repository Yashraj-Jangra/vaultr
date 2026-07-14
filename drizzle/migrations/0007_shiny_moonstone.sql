CREATE TABLE "vault_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_item_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_name" text NOT NULL,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"size_bytes" integer NOT NULL,
	"s3_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vault_attachments_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "storage_used_bytes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "storage_quota_bytes" integer DEFAULT 104857600;--> statement-breakpoint
ALTER TABLE "vault_attachments" ADD CONSTRAINT "vault_attachments_vault_item_id_vault_items_id_fk" FOREIGN KEY ("vault_item_id") REFERENCES "public"."vault_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_attachments" ADD CONSTRAINT "vault_attachments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;