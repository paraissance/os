CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"provider" text DEFAULT 'blotato' NOT NULL,
	"account_id" text NOT NULL,
	"subaccount_id" text DEFAULT '' NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'blotato' NOT NULL,
	"account_id" text NOT NULL,
	"subaccount_id" text DEFAULT '' NOT NULL,
	"account_name" text,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"post_time" timestamp with time zone NOT NULL,
	"text" text NOT NULL,
	"media_count" integer DEFAULT 0 NOT NULL,
	"post_url" text,
	"error_message" text,
	"metrics" jsonb,
	"metrics_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_status_check" CHECK ("social_posts"."status" in ('scheduled', 'published', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_target_unique" ON "social_accounts" USING btree ("provider","account_id","subaccount_id");--> statement-breakpoint
CREATE INDEX "social_accounts_business_idx" ON "social_accounts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "social_posts_target_time_idx" ON "social_posts" USING btree ("account_id","subaccount_id","post_time");--> statement-breakpoint
CREATE INDEX "social_posts_status_time_idx" ON "social_posts" USING btree ("status","post_time");