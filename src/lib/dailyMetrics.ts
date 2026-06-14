import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface DailyMetricsEntry {
    date: string;
    calories: number | null;
    steps: number | null;
    sleepHours: number | null;
}

export interface DailyMetricTargets {
    targetCalories: number | null;
    targetSteps: number | null;
    targetSleepHours: number | null;
}

let dailyMetricsReady = false;
let dailyMetricTargetColumnsReady = false;

export async function ensureDailyMetricsTable() {
    if (dailyMetricsReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "daily_metric_logs" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "loggedDate" DATE NOT NULL,
            "calories" INTEGER,
            "steps" INTEGER,
            "sleepHours" DOUBLE PRECISION,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "daily_metric_logs_userId_loggedDate_key"
        ON "daily_metric_logs"("userId", "loggedDate")
    `;

    dailyMetricsReady = true;
}

export async function ensureDailyMetricTargetColumns() {
    if (dailyMetricTargetColumnsReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "targetCalories" INTEGER,
        ADD COLUMN IF NOT EXISTS "targetSteps" INTEGER,
        ADD COLUMN IF NOT EXISTS "targetSleepHours" DOUBLE PRECISION
    `;

    dailyMetricTargetColumnsReady = true;
}

export async function getDailyMetricTargets(userId: string): Promise<DailyMetricTargets> {
    await ensureDailyMetricTargetColumns();

    const rows = await prisma.$queryRaw<DailyMetricTargets[]>`
        SELECT "targetCalories", "targetSteps", "targetSleepHours"
        FROM "users"
        WHERE "id" = ${userId}
        LIMIT 1
    `;

    return rows[0] ?? { targetCalories: null, targetSteps: null, targetSleepHours: null };
}

export async function updateDailyMetricTargets(userId: string, targets: DailyMetricTargets) {
    await ensureDailyMetricTargetColumns();

    await prisma.$executeRaw`
        UPDATE "users"
        SET
            "targetCalories" = ${targets.targetCalories},
            "targetSteps" = ${targets.targetSteps},
            "targetSleepHours" = ${targets.targetSleepHours},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${userId}
    `;
}

export async function getDailyMetricsSummary(userId: string, date: string) {
    await ensureDailyMetricsTable();

    const [selected, latest, targets] = await Promise.all([
        prisma.$queryRaw<DailyMetricsEntry[]>`
            SELECT "loggedDate"::text AS "date", "calories", "steps", "sleepHours"
            FROM "daily_metric_logs"
            WHERE "userId" = ${userId} AND "loggedDate" = ${date}::date
            LIMIT 1
        `,
        prisma.$queryRaw<DailyMetricsEntry[]>`
            SELECT "loggedDate"::text AS "date", "calories", "steps", "sleepHours"
            FROM "daily_metric_logs"
            WHERE "userId" = ${userId}
            ORDER BY "loggedDate" DESC
            LIMIT 1
        `,
        getDailyMetricTargets(userId),
    ]);

    return {
        selected: selected[0] ?? null,
        latest: latest[0] ?? null,
        targets,
    };
}

export async function saveDailyMetricsEntry(userId: string, date: string, entry: Omit<DailyMetricsEntry, "date">) {
    await ensureDailyMetricsTable();

    await prisma.$executeRaw`
        INSERT INTO "daily_metric_logs" ("id", "userId", "loggedDate", "calories", "steps", "sleepHours", "updatedAt")
        VALUES (${randomUUID()}, ${userId}, ${date}::date, ${entry.calories}, ${entry.steps}, ${entry.sleepHours}, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "loggedDate")
        DO UPDATE SET
            "calories" = ${entry.calories},
            "steps" = ${entry.steps},
            "sleepHours" = ${entry.sleepHours},
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    return getDailyMetricsSummary(userId, date);
}

export function normalizeDailyMetricDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Invalid date");
    }
    return date;
}

export function normalizeCalories(calories?: number | null) {
    if (calories === null || calories === undefined) return null;
    if (!Number.isFinite(calories) || calories < 0 || calories > 20000) {
        throw new Error("Invalid calories");
    }
    return Math.round(calories);
}

export function normalizeSteps(steps?: number | null) {
    if (steps === null || steps === undefined) return null;
    if (!Number.isFinite(steps) || steps < 0 || steps > 200000) {
        throw new Error("Invalid steps");
    }
    return Math.round(steps);
}

export function normalizeSleepHours(sleepHours?: number | null) {
    if (sleepHours === null || sleepHours === undefined) return null;
    if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24) {
        throw new Error("Invalid sleep");
    }
    return Math.round(sleepHours * 10) / 10;
}
