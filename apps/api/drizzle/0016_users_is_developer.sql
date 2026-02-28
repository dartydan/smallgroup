ALTER TABLE "users"
ADD COLUMN "is_developer" boolean NOT NULL DEFAULT false;

UPDATE "users"
SET "is_developer" = true
WHERE lower("email") = 'dan@zoomi.co';
