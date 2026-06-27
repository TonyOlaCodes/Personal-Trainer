-- CreateTable
CREATE TABLE IF NOT EXISTS "plan_schedule_revisions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "priorWeeks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_schedule_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "plan_schedule_revisions_planId_effectiveFrom_idx"
ON "plan_schedule_revisions"("planId", "effectiveFrom");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'plan_schedule_revisions_planId_fkey'
    ) THEN
        ALTER TABLE "plan_schedule_revisions"
        ADD CONSTRAINT "plan_schedule_revisions_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
