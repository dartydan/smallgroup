ALTER TABLE "group_members"
ADD COLUMN IF NOT EXISTS "can_edit_events_announcements" boolean DEFAULT false NOT NULL;
