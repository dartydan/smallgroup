DO $$
BEGIN
  CREATE TYPE "public"."prayer_request_activity_type" AS ENUM('prayed', 'comment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prayer_request_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "prayer_request_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "activity_type" "prayer_request_activity_type" NOT NULL,
  "comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_request_activity" ADD CONSTRAINT "prayer_request_activity_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_request_activity" ADD CONSTRAINT "prayer_request_activity_prayer_request_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_request_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_request_activity" ADD CONSTRAINT "prayer_request_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prayer_request_activity_prayer_id_created_idx" ON "prayer_request_activity" USING btree ("prayer_request_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prayer_request_activity_group_created_idx" ON "prayer_request_activity" USING btree ("group_id","created_at");
