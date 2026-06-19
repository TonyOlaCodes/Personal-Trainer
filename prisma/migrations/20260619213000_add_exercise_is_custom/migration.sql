ALTER TABLE "exercises"
ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;

UPDATE "exercises"
SET "isCustom" = false
WHERE "isCustom" IS NULL;

ALTER TABLE "exercises"
ALTER COLUMN "isCustom" SET DEFAULT false,
ALTER COLUMN "isCustom" SET NOT NULL;
