ALTER TABLE "session" ADD COLUMN "impersonatedBy" text;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD COLUMN "verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD COLUMN "failedVerificationCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD COLUMN "lockedUntil" timestamp;