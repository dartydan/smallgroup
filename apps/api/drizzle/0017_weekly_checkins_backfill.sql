DO $$ BEGIN
 CREATE TYPE "public"."weekly_checkin_status" AS ENUM('great', 'okay', 'struggling');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_checkins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" "weekly_checkin_status" NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_checkins_group_created_idx" ON "weekly_checkins" USING btree ("group_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_checkins_user_created_idx" ON "weekly_checkins" USING btree ("user_id","created_at");
