DO $$ BEGIN
 CREATE TYPE "public"."feature_board_status" AS ENUM('suggested', 'planned', 'in_progress', 'done');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_board_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" "feature_board_status" DEFAULT 'suggested' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "suggested_by_user_id" uuid,
  "suggested_by_name" text NOT NULL,
  "suggested_by_email" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_board_cards" ADD CONSTRAINT "feature_board_cards_suggested_by_user_id_users_id_fk" FOREIGN KEY ("suggested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_board_cards_status_sort_order_idx" ON "feature_board_cards" USING btree ("status","sort_order","created_at");
