-- Per-exercise, per-session athlete notes.
CREATE TABLE IF NOT EXISTS "log_exercise_notes" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_exercise_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "log_exercise_notes_workoutLogId_exerciseId_key"
    ON "log_exercise_notes"("workoutLogId", "exerciseId");

CREATE INDEX IF NOT EXISTS "log_exercise_notes_workoutLogId_idx"
    ON "log_exercise_notes"("workoutLogId");

DO $$
BEGIN
    ALTER TABLE "log_exercise_notes"
        ADD CONSTRAINT "log_exercise_notes_workoutLogId_fkey"
        FOREIGN KEY ("workoutLogId") REFERENCES "workout_logs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
