CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_codes_user_idx" ON "login_codes" USING btree ("user_id");--> statement-breakpoint
-- Everyone already here gets a username made from their name ("Jody" -> "jody"); a repeated one gets a number.
UPDATE "users" AS u
SET "username" = d.base || CASE WHEN d.n > 1 THEN d.n::text ELSE '' END
FROM (
	SELECT "id",
		left(lower(regexp_replace("name", '[^A-Za-z0-9]', '', 'g')), 30) AS base,
		row_number() OVER (PARTITION BY left(lower(regexp_replace("name", '[^A-Za-z0-9]', '', 'g')), 30) ORDER BY ("role" <> 'owner'), "created_at") AS n
	FROM "users"
) AS d
WHERE u."id" = d."id" AND length(d.base) >= 3;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");