/**
 * Runtime column + uniqueness for workout-log concurrency.
 * Only IN_PROGRESS drafts are touched when collapsing duplicates.
 */

import { prisma } from "@/lib/prisma";

let ready = false;

export async function ensureWorkoutLogConcurrencySchema() {
    if (ready) return;

    await prisma.$executeRaw`
        ALTER TABLE "workout_logs"
        ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0
    `;

    // Keep the newest draft per user so the unique index can be created safely.
    await prisma.$executeRaw`
        DELETE FROM "workout_logs" AS stale
        WHERE stale."status" = 'IN_PROGRESS'
          AND EXISTS (
            SELECT 1
            FROM "workout_logs" AS newer
            WHERE newer."userId" = stale."userId"
              AND newer."status" = 'IN_PROGRESS'
              AND newer."updatedAt" > stale."updatedAt"
          )
    `;

    await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "workout_logs_one_in_progress_per_user_idx"
        ON "workout_logs" ("userId")
        WHERE "status" = 'IN_PROGRESS'
    `;

    ready = true;
}
