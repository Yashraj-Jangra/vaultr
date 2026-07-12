CREATE TABLE "session_meta" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_name" text,
	"browser" text,
	"os" text,
	"ip_address" text,
	"country" text,
	"city" text,
	"last_active_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "session_meta" ADD CONSTRAINT "session_meta_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_meta" ADD CONSTRAINT "session_meta_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;