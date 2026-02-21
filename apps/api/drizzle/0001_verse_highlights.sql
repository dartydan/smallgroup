CREATE TABLE IF NOT EXISTS "verse_highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse_number" integer NOT NULL,
	"verse_reference" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_highlights" ADD CONSTRAINT "verse_highlights_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_highlights" ADD CONSTRAINT "verse_highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verse_highlights_group_user_verse_unique" ON "verse_highlights" USING btree ("group_id","user_id","book","chapter","verse_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verse_highlights_group_book_chapter_created_idx" ON "verse_highlights" USING btree ("group_id","book","chapter","created_at");
