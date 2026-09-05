-- H7: move persistent runtime-created tables into Prisma migrations.
-- All statements are IF NOT EXISTS so existing production databases stay compatible.

CREATE TABLE IF NOT EXISTS "bodyweight_logs" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "loggedDate" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "bodyweight_logs_userId_loggedDate_key"
    ON "bodyweight_logs"("userId", "loggedDate");

CREATE TABLE IF NOT EXISTS "daily_metric_logs" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "loggedDate" DATE NOT NULL,
    "calories" INTEGER,
    "steps" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_metric_logs_userId_loggedDate_key"
    ON "daily_metric_logs"("userId", "loggedDate");

CREATE TABLE IF NOT EXISTS "pending_coach_notifications" (
    "id" TEXT PRIMARY KEY,
    "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "prefKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "route" TEXT NOT NULL,
    "deliverAfter" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "pending_coach_notifications_coach_deliver_idx"
    ON "pending_coach_notifications"("coachId", "deliverAfter")
    WHERE "sentAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "pending_coach_notifications_unsent_identity_key"
    ON "pending_coach_notifications"("coachId", "type", "entityId")
    WHERE "sentAt" IS NULL;

CREATE TABLE IF NOT EXISTS "coach_attention_actions" (
    "id" TEXT PRIMARY KEY,
    "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "alertKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weekNumber" INTEGER,
    "dateKey" TEXT,
    "workoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("coachId", "alertKey")
);

CREATE INDEX IF NOT EXISTS "coach_attention_actions_client_idx"
    ON "coach_attention_actions"("clientId");

CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" TEXT PRIMARY KEY,
    "filename" TEXT NOT NULL UNIQUE,
    "ownerUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "purpose" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "blobUrl" TEXT,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "media_assets_ownerUserId_idx"
    ON "media_assets"("ownerUserId");

CREATE TABLE IF NOT EXISTS "check_in_requests" (
    "id" TEXT PRIMARY KEY,
    "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "weekNumber" INTEGER NOT NULL,
    "periodDueDateKey" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    UNIQUE ("clientId", "weekNumber")
);

CREATE INDEX IF NOT EXISTS "check_in_requests_client_active_idx"
    ON "check_in_requests"("clientId")
    WHERE "clearedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "check_in_requests_coach_active_idx"
    ON "check_in_requests"("coachId")
    WHERE "clearedAt" IS NULL;
