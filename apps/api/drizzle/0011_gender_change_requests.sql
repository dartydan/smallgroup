CREATE TABLE IF NOT EXISTS "gender_change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "current_gender" "gender" NOT NULL,
  "requested_gender" "gender" NOT NULL,
  "status" "group_join_request_status" DEFAULT 'pending' NOT NULL,
  "reviewed_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gender_change_requests" ADD CONSTRAINT "gender_change_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gender_change_requests" ADD CONSTRAINT "gender_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gender_change_requests" ADD CONSTRAINT "gender_change_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gender_change_requests_group_status_idx" ON "gender_change_requests" USING btree ("group_id","status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gender_change_requests_user_status_idx" ON "gender_change_requests" USING btree ("user_id","status","created_at");
