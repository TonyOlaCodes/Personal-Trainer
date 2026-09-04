/**
 * Indexes that support real history / active-session / PR query patterns:
 * - find a user's completed logs by date
 * - find the single IN_PROGRESS row
 * - join completed working sets for all-time record boards
 */
import { prisma } from "@/lib/prisma";

let indexesReady = false;

export async function ensureWorkoutHistoryIndexes() {
    if (indexesReady) return;

    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_logs_userId_status_loggedAt_idx"
        ON "workout_logs" ("userId", "status", "loggedAt")
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_logs_userId_status_updatedAt_idx"
        ON "workout_logs" ("userId", "status", "updatedAt")
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "workout_logs_userId_workoutId_status_loggedAt_idx"
        ON "workout_logs" ("userId", "workoutId", "status", "loggedAt")
    `;

    indexesReady = true;
}
