CREATE UNIQUE INDEX IF NOT EXISTS "group_members_group_user_unique"
ON "group_members" ("group_id", "user_id");
