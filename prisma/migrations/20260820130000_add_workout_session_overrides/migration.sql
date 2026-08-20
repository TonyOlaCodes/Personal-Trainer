-- One-off coach/client session overrides (do not mutate the recurring plan).
CREATE TABLE IF NOT EXISTS "workout_session_overrides" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "dateKey" TEXT NOT NULL,
    "baseWorkoutId" TEXT NOT NULL,
    "workoutName" TEXT,
    "notes" TEXT,
    "exercises" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "dateKey", "baseWorkoutId")
);
CREATE INDEX IF NOT EXISTS "workout_session_overrides_user_date_idx"
ON "workout_session_overrides"("userId", "dateKey");
