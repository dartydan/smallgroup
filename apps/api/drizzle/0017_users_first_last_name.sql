ALTER TABLE "users"
ADD COLUMN "first_name" text,
ADD COLUMN "last_name" text;

UPDATE "users"
SET
  "first_name" = NULLIF(split_part(trim(coalesce("display_name", '')), ' ', 1), ''),
  "last_name" = NULLIF(NULLIF(trim(substring(trim(coalesce("display_name", '')) from position(' ' in trim(coalesce("display_name", ''))) + 1)), trim(coalesce("display_name", ''))), '');
