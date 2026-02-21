ALTER TABLE "snack_slots"
ADD COLUMN IF NOT EXISTS "is_cancelled" boolean DEFAULT false NOT NULL;
