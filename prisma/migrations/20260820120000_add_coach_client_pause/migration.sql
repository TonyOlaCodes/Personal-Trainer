-- Coach-only pause: silences alerts without deactivating the client account.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isCoachPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "coachPausedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "coachResumedAt" TIMESTAMP(3);
