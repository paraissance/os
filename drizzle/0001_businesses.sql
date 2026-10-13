CREATE TABLE "business_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"link_label" text,
	"link_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'page' NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_links_kind_check" CHECK ("business_links"."kind" in ('page', 'social', 'login', 'tool', 'other'))
);
--> statement-breakpoint
CREATE TABLE "business_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"url" text,
	"platform" text,
	"registrar" text,
	"registrar_account" text,
	"registrar_login_url" text,
	"domain_expiry" date,
	"domain_auto_renew" boolean DEFAULT false NOT NULL,
	"hosting_provider" text,
	"hosting_plan" text,
	"hosting_account" text,
	"hosting_login_url" text,
	"hosting_expiry" date,
	"ssl_provider" text,
	"ssl_expiry" date,
	"server_ip" text,
	"nameservers" text,
	"last_backup" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"about" text,
	"website_url" text,
	"cta_label" text,
	"cta_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_check" CHECK ("businesses"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "businesses_status_check" CHECK ("businesses"."status" in ('active', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"next_renewal" date,
	"login_url" text,
	"account" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_cycle_check" CHECK ("subscriptions"."billing_cycle" in ('monthly', 'yearly', 'quarterly', 'one_time')),
	CONSTRAINT "subscriptions_amount_check" CHECK ("subscriptions"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "business_faqs" ADD CONSTRAINT "business_faqs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_links" ADD CONSTRAINT "business_links_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_sites" ADD CONSTRAINT "business_sites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_faqs_business_idx" ON "business_faqs" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_links_business_idx" ON "business_links" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_sites_business_idx" ON "business_sites" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_unique" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscriptions_business_idx" ON "subscriptions" USING btree ("business_id");