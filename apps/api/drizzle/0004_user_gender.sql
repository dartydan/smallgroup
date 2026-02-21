DO $$
BEGIN
  CREATE TYPE "public"."gender" AS ENUM('male', 'female');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "gender";
