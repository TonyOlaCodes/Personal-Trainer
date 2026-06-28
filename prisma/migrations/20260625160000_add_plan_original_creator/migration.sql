-- AlterTable
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "originalCreatorId" TEXT;

-- Backfill from current owner (first creator for existing rows)
UPDATE "plans"
SET "originalCreatorId" = "creatorId"
WHERE "originalCreatorId" IS NULL AND "creatorId" IS NOT NULL;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'plans_originalCreatorId_fkey'
    ) THEN
        ALTER TABLE "plans"
        ADD CONSTRAINT "plans_originalCreatorId_fkey"
        FOREIGN KEY ("originalCreatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
