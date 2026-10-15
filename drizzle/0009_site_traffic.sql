CREATE TABLE "site_traffic" (
	"business_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_traffic_business_id_day_pk" PRIMARY KEY("business_id","day")
);
--> statement-breakpoint
ALTER TABLE "site_traffic" ADD CONSTRAINT "site_traffic_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;