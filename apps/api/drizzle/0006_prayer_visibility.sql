DO $$
BEGIN
  CREATE TYPE "public"."prayer_visibility" AS ENUM('everyone', 'my_gender', 'specific_people');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD COLUMN IF NOT EXISTS "visibility" "prayer_visibility";
--> statement-breakpoint
ALTER TABLE "prayer_requests" ALTER COLUMN "visibility" SET DEFAULT 'everyone';
--> statement-breakpoint
UPDATE "prayer_requests"
SET "visibility" = CASE
  WHEN "is_private" = true THEN 'specific_people'::"prayer_visibility"
  ELSE 'everyone'::"prayer_visibility"
END
WHERE "visibility" IS NULL;
--> statement-breakpoint
ALTER TABLE "prayer_requests" ALTER COLUMN "visibility" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prayer_request_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "prayer_request_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_request_recipients" ADD CONSTRAINT "prayer_request_recipients_prayer_request_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_request_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_request_recipients" ADD CONSTRAINT "prayer_request_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prayer_request_recipients_prayer_user_unique" ON "prayer_request_recipients" USING btree ("prayer_request_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prayer_request_recipients_prayer_id_idx" ON "prayer_request_recipients" USING btree ("prayer_request_id");
