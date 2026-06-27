import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface BodyweightEntry {
    date: string;
    weightKg: number;
}

let bodyweightTableReady = false;

export async function ensureBodyweightTable() {
    if (bodyweightTableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "bodyweight_logs" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "loggedDate" DATE NOT NULL,
            "weightKg" DOUBLE PRECISION NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "bodyweight_logs_userId_loggedDate_key"
        ON "bodyweight_logs"("userId", "loggedDate")
    `;

    bodyweightTableReady = true;
}

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err: any) {
        const msg = String(err.message || err);
        if (msg.includes("does not exist") || msg.includes("P2010") || msg.includes("relation") || msg.includes("column")) {
            console.warn("[Bodyweight] Table or column missing, resetting ready state and retrying...", err);
            bodyweightTableReady = false;
            await ensureBodyweightTable();
            return await fn();
        }
        throw err;
    }
}

export async function getBodyweightSummary(userId: string, date: string) {
    return runWithRetry(async () => {
        await ensureBodyweightTable();

        const [selectedEntry, selectedPreviousEntry, latestEntry] = await Promise.all([
            prisma.$queryRaw<BodyweightEntry[]>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${userId} AND "loggedDate" = ${date}::date
                LIMIT 1
            `,
            prisma.$queryRaw<BodyweightEntry[]>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${userId} AND "loggedDate" < ${date}::date
                ORDER BY "loggedDate" DESC
                LIMIT 1
            `,
            prisma.$queryRaw<BodyweightEntry[]>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${userId}
                ORDER BY "loggedDate" DESC
                LIMIT 1
            `,
        ]);

        const latestPreviousEntry = latestEntry[0]
            ? await prisma.$queryRaw<BodyweightEntry[]>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${userId} AND "loggedDate" < ${latestEntry[0].date}::date
                ORDER BY "loggedDate" DESC
                LIMIT 1
            `
            : [];

        return {
            selected: selectedEntry[0] ?? null,
            selectedPrevious: selectedPreviousEntry[0] ?? null,
            latest: latestEntry[0] ?? null,
            latestPrevious: latestPreviousEntry[0] ?? null,
        };
    });
}

export function addDaysToDateStr(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Average bodyweight between two dates (inclusive). */
export async function getBodyweightAverageInRange(
    userId: string,
    startDateStr: string,
    endDateStr: string
): Promise<{ averageWeightKg: number | null; entries: number }> {
    return runWithRetry(async () => {
        await ensureBodyweightTable();

        const rows = await prisma.$queryRaw<Array<{ averageWeightKg: number | null; entries: bigint }>>`
            SELECT AVG("weightKg")::float AS "averageWeightKg", COUNT(*)::bigint AS "entries"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= ${startDateStr}::date
                AND "loggedDate" <= ${endDateStr}::date
        `;

        const averageWeightKg = rows[0]?.averageWeightKg != null
            ? Math.round(rows[0].averageWeightKg * 100) / 100
            : null;

        return {
            averageWeightKg,
            entries: Number(rows[0]?.entries ?? 0),
        };
    });
}

export async function getBodyweightWeeklyAverage(userId: string, date: string) {
    return runWithRetry(async () => {
        await ensureBodyweightTable();

        const rows = await prisma.$queryRaw<Array<{ averageWeightKg: number | null; entries: bigint }>>`
            SELECT AVG("weightKg")::float AS "averageWeightKg", COUNT(*)::bigint AS "entries"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= date_trunc('week', ${date}::date)::date
                AND "loggedDate" < (date_trunc('week', ${date}::date)::date + INTERVAL '7 days')
        `;

        const previousRows = await prisma.$queryRaw<Array<{ averageWeightKg: number | null; entries: bigint }>>`
            SELECT AVG("weightKg")::float AS "averageWeightKg", COUNT(*)::bigint AS "entries"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= (date_trunc('week', ${date}::date)::date - INTERVAL '7 days')
                AND "loggedDate" < date_trunc('week', ${date}::date)::date
        `;

        const current = rows[0];
        const previous = previousRows[0];

        return {
            averageWeightKg: current?.averageWeightKg ? Math.round(current.averageWeightKg * 100) / 100 : null,
            entries: Number(current?.entries ?? 0),
            previousAverageWeightKg: previous?.averageWeightKg ? Math.round(previous.averageWeightKg * 100) / 100 : null,
            previousEntries: Number(previous?.entries ?? 0),
        };
    });
}

export async function saveBodyweightEntry(userId: string, date: string, weightKg: number) {
    return runWithRetry(async () => {
        await ensureBodyweightTable();

        await prisma.$executeRaw`
            INSERT INTO "bodyweight_logs" ("id", "userId", "loggedDate", "weightKg", "updatedAt")
            VALUES (${randomUUID()}, ${userId}, ${date}::date, ${weightKg}, CURRENT_TIMESTAMP)
            ON CONFLICT ("userId", "loggedDate")
            DO UPDATE SET "weightKg" = ${weightKg}, "updatedAt" = CURRENT_TIMESTAMP
        `;

        const latest = await prisma.$queryRaw<BodyweightEntry[]>`
            SELECT "loggedDate"::text AS "date", "weightKg"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
            ORDER BY "loggedDate" DESC
            LIMIT 1
        `;

        if (latest[0]?.date === date) {
            await prisma.user.update({
                where: { id: userId },
                data: { weightKg: Math.round(weightKg * 100) / 100 },
            });
        }

        return getBodyweightSummary(userId, date);
    });
}

export function normalizeBodyweightDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Invalid date");
    }
    return date;
}

export function normalizeBodyweight(weightKg: number) {
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
        throw new Error("Invalid weight");
    }
    return Math.round(weightKg * 100) / 100;
}

/** Human-readable distance from target weight after a log (respects goal direction when set). */
export function formatWeightDistanceFromGoal(
    currentKg: number,
    targetKg: number,
    goal?: string | null
): string {
    const diff = Math.round((currentKg - targetKg) * 10) / 10;
    const abs = Math.abs(diff);
    if (abs < 0.05) return "At goal";

    if (goal === "LOSE_WEIGHT" || goal === "RECOMPOSITION") {
        if (diff > 0) return `${abs.toFixed(1)} kg to goal`;
        return `${abs.toFixed(1)} kg below goal`;
    }
    if (goal === "GAIN_MUSCLE" || goal === "STRENGTH") {
        if (diff < 0) return `${abs.toFixed(1)} kg to goal`;
        return `${abs.toFixed(1)} kg above goal`;
    }

    return `${abs.toFixed(1)} kg from goal`;
}
