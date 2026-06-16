CREATE TABLE IF NOT EXISTS "workout_notes" (
    "id" TEXT PRIMARY KEY,
    "workoutLogId" TEXT NOT NULL REFERENCES "workout_logs"("id") ON DELETE CASCADE,
    "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "workout_notes_workoutLogId_idx" ON "workout_notes"("workoutLogId");
CREATE INDEX IF NOT EXISTS "workout_notes_coachId_idx" ON "workout_notes"("coachId");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "route" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx" ON "notifications"("userId", "read");
CREATE INDEX IF NOT EXISTS "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");
