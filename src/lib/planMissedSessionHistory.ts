import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import type { ScheduleWeekSnapshot } from "@/lib/planScheduleHistory";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface HistoricalMissedSession {
    dateKey: string;
    workoutId: string;
    workoutName: string;
}

let tableReady = false;

export async function ensurePlanMissedSessionHistoryTable() {
    if (tableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "plan_missed_session_history" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "planId" TEXT NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
            "dateKey" TEXT NOT NULL,
            "workoutId" TEXT NOT NULL,
            "workoutName" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "plan_missed_session_history_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "plan_missed_session_history_user_date_workout_key"
                UNIQUE ("userId", "dateKey", "workoutId")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "plan_missed_session_history_userId_dateKey_idx"
        ON "plan_missed_session_history" ("userId", "dateKey")
    `;

    tableReady = true;
}

function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function eachDateKeyInclusive(fromKey: string, toKey: string): string[] {
    const keys: string[] = [];
    let cur = fromKey;
    while (cur <= toKey) {
        keys.push(cur);
        cur = addDaysToDateKey(cur, 1);
    }
    return keys;
}

function buildSchedulePlan(
    startedAt: Date,
    priorWeeks: ScheduleWeekSnapshot[]
): ActiveUserPlanLike {
    return {
        startedAt,
        plan: { weeks: priorWeeks },
        scheduleRevisions: [],
    };
}

/** Freeze missed sessions from the pre-change schedule so past calendar cells stay accurate. */
export async function snapshotMissedSessionsForPlanChange(
    tx: Prisma.TransactionClient,
    planId: string,
    priorWeeks: ScheduleWeekSnapshot[],
    referenceDate = new Date()
) {
    await ensurePlanMissedSessionHistoryTable();

    const { dateKey: todayKey } = getLocalTimeParts(referenceDate, APP_TIMEZONE);
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    if (priorWeeks.length === 0) return;

    const userPlans = await tx.userPlan.findMany({
        where: { planId, isActive: true },
        select: {
            userId: true,
            startedAt: true,
        },
    });

    if (userPlans.length === 0) return;

    const userIds = userPlans.map((row) => row.userId);
    const completedLogs = await tx.workoutLog.findMany({
        where: {
            userId: { in: userIds },
            status: "COMPLETED",
        },
        select: {
            userId: true,
            workoutId: true,
            loggedAt: true,
        },
    });

    const completedByUser = new Map<string, Set<string>>();
    for (const log of completedLogs) {
        const logDateKey = getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey;
        const key = `${logDateKey}:${log.workoutId}`;
        const set = completedByUser.get(log.userId) ?? new Set<string>();
        set.add(key);
        completedByUser.set(log.userId, set);
    }

    const today = parseLogDate(todayKey);

    for (const userPlan of userPlans) {
        const startedKey = toDateKey(userPlan.startedAt);
        if (startedKey > yesterdayKey) continue;

        const schedulePlan = buildSchedulePlan(userPlan.startedAt, priorWeeks);
        const clientActions = await getClientAttentionActions(userPlan.userId);
        const excusedKeys = getExcusedMissedWorkoutKeys(clientActions);
        const completedKeys = completedByUser.get(userPlan.userId) ?? new Set<string>();

        for (const dateKey of eachDateKeyInclusive(startedKey, yesterdayKey)) {
            const planned = getPlannedWorkoutForDate(schedulePlan, parseLogDate(dateKey), { today });
            if (!planned) continue;

            const slotKey = `${dateKey}:${planned.id}`;
            if (completedKeys.has(slotKey) || excusedKeys.has(slotKey)) continue;

            await tx.$executeRaw`
                INSERT INTO "plan_missed_session_history" (
                    "id", "userId", "planId", "dateKey", "workoutId", "workoutName"
                )
                VALUES (
                    ${randomUUID()},
                    ${userPlan.userId},
                    ${planId},
                    ${dateKey},
                    ${planned.id},
                    ${planned.name}
                )
                ON CONFLICT ("userId", "dateKey", "workoutId") DO UPDATE
                SET "workoutName" = EXCLUDED."workoutName"
            `;
        }
    }
}

export async function loadHistoricalMissedSessions(userId: string): Promise<HistoricalMissedSession[]> {
    await ensurePlanMissedSessionHistoryTable();

    const rows = await prisma.$queryRaw<Array<{
        dateKey: string;
        workoutId: string;
        workoutName: string;
    }>>`
        SELECT "dateKey", "workoutId", "workoutName"
        FROM "plan_missed_session_history"
        WHERE "userId" = ${userId}
        ORDER BY "dateKey" ASC
    `;

    return rows.map((row) => ({
        dateKey: row.dateKey,
        workoutId: row.workoutId,
        workoutName: row.workoutName,
    }));
}

export function historicalMissedSessionsByDate(
    sessions: HistoricalMissedSession[]
): Map<string, HistoricalMissedSession> {
    return new Map(sessions.map((session) => [session.dateKey, session]));
}
