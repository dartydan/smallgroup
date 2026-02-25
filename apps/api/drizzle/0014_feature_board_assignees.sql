ALTER TABLE "feature_board_cards"
ADD COLUMN "assigned_to_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "feature_board_cards"
ADD COLUMN "assigned_to_name" text;
--> statement-breakpoint
ALTER TABLE "feature_board_cards"
ADD CONSTRAINT "feature_board_cards_assigned_to_user_id_users_id_fk"
FOREIGN KEY ("assigned_to_user_id")
REFERENCES "public"."users"("id")
ON DELETE SET NULL
ON UPDATE NO ACTION;
