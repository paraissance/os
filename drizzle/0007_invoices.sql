CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"billed_on" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_source_check" CHECK ("invoices"."source" in ('claude', 'console')),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('paid', 'unpaid', 'refunded', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_source_day_amount_unique" ON "invoices" USING btree ("source","billed_on","amount");