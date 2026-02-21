CREATE TABLE IF NOT EXISTS "verse_practice_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verse_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_practice_completions" ADD CONSTRAINT "verse_practice_completions_verse_id_verse_memory_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."verse_memory"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_practice_completions" ADD CONSTRAINT "verse_practice_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verse_practice_completions_verse_user_level_unique" ON "verse_practice_completions" USING btree ("verse_id","user_id","level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verse_practice_completions_verse_level_completed_idx" ON "verse_practice_completions" USING btree ("verse_id","level","completed_at");
