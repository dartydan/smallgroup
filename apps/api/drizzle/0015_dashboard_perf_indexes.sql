CREATE INDEX IF NOT EXISTS "group_members_user_joined_idx"
  ON "group_members" ("user_id", "joined_at");

CREATE INDEX IF NOT EXISTS "announcements_group_created_idx"
  ON "announcements" ("group_id", "created_at");

CREATE INDEX IF NOT EXISTS "snack_slots_group_date_cancelled_idx"
  ON "snack_slots" ("group_id", "slot_date", "is_cancelled");

CREATE INDEX IF NOT EXISTS "snack_signups_slot_created_idx"
  ON "snack_signups" ("slot_id", "created_at");

CREATE INDEX IF NOT EXISTS "prayer_requests_group_created_idx"
  ON "prayer_requests" ("group_id", "created_at");

CREATE INDEX IF NOT EXISTS "discussion_topics_group_year_month_idx"
  ON "discussion_topics" ("group_id", "year", "month");

CREATE INDEX IF NOT EXISTS "verse_memory_group_year_month_idx"
  ON "verse_memory" ("group_id", "year", "month");
