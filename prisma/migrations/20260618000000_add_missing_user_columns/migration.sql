-- Add hiddenGoals column (array of goal strings coaches want to hide from a client's dashboard)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hiddenGoals" TEXT[] NOT NULL DEFAULT '{}';

-- Add check-in schedule columns (used by checkInSchedule.ts for scheduling recurring check-ins)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "checkInDay" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "checkInFrequencyWeeks" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "checkInStartDate" TIMESTAMP(3);

-- Add daily metric target columns (used by dailyMetrics.ts for calorie/step/sleep goals)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "targetCalories" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "targetSteps" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "targetSleepHours" DOUBLE PRECISION;
