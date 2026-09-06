CREATE TYPE "public"."account_kind" AS ENUM('registered', 'guest');--> statement-breakpoint
ALTER TYPE "public"."conversation_type" ADD VALUE 'shared';--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "nickname" varchar(80);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_kind" "account_kind" DEFAULT 'registered' NOT NULL;