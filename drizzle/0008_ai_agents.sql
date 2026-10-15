CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"language" text DEFAULT 'en' NOT NULL,
	"safety_profile" text,
	"brand_color" text,
	"accent_color" text,
	"cta_label" text,
	"cta_url" text,
	"greeting" text NOT NULL,
	"note" text,
	"starters" jsonb NOT NULL,
	"keywords" jsonb NOT NULL,
	"fallback_links" jsonb NOT NULL,
	"knowledge" text NOT NULL,
	"instructions" text,
	"crisis" jsonb,
	"shortcode" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agents_business_unique" ON "ai_agents" USING btree ("business_id");