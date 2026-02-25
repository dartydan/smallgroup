CREATE TABLE IF NOT EXISTS "feature_board_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_board_votes" ADD CONSTRAINT "feature_board_votes_card_id_feature_board_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."feature_board_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_board_votes" ADD CONSTRAINT "feature_board_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feature_board_votes_card_user_unique" ON "feature_board_votes" USING btree ("card_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_board_votes_card_created_idx" ON "feature_board_votes" USING btree ("card_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_board_votes_user_created_idx" ON "feature_board_votes" USING btree ("user_id","created_at");
