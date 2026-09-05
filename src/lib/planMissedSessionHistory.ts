import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { historicalAssignmentWindow, priorResetAssignmentWindow } from "@/lib/calendarScheduledSession";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import {
    loadPlanScheduleRevisionsByPlanIds,
    serializePlanWeeksForSchedule,
    type ScheduleWeekSnapshot,
} from "@/lib/planScheduleHistory";
import { isRestPlanWorkout } from "@/lib/planTrainingTarget";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { listSessionOverridesForUser } from "@/lib/workoutSessionOverrides";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface HistoricalMissedSession {
    planId?: string;
    dateKey: string;
    workoutId: string;
    workoutName: string;
}

type HistoryDb = Prisma.TransactionClient | typeof prisma;

let tableReady = false;

export async function ensurePlanMissedSessionHistoryTable() {
    if (tableReady) return;

    try {
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "plan_missed_session_history" (
                "id" TEXT NOT NULL,
                "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "planId" TEXT REFERENCES "plans"("id") ON DELETE SET NULL,
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
        await softenPlanMissedSessionHistoryPlanFk();
        tableReady = true;
    } catch (error) {
        console.error("[ensurePlanMissedSessionHistoryTable] failed", error);
    }
}

/** Keep historical rows if a plan is later deleted. Never cascade-wipe training history. */
async function softenPlanMissedSessionHistoryPlanFk() {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "plan_missed_session_history"
        ALTER COLUMN "planId" DROP NOT NULL
    `).catch(() => undefined);

    await prisma.$executeRawUnsafe(`
        ALTER TABLE "plan_missed_session_history"
        DROP CONSTRAINT IF EXISTS "plan_missed_session_history_planId_fkey"
    `).catch(() => undefined);

    await prisma.$executeRawUnsafe(`
        ALTER TABLE "plan_missed_session_history"
        ADD CONSTRAINT "plan_missed_session_history_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL
    `).catch(() => undefined);
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

async function upsertFrozenScheduledSession(
    db: HistoryDb,
    row: {
        userId: string;
        planId: string | null;
        dateKey: string;
        workoutId: string;
        workoutName: string;
    }
) {
    await db.$executeRaw`
        INSERT INTO "plan_missed_session_history" (
            "id", "userId", "planId", "dateKey", "workoutId", "workoutName"
        )
        VALUES (
            ${randomUUID()},
            ${row.userId},
            ${row.planId},
            ${row.dateKey},
            ${row.workoutId},
            ${row.workoutName}
        )
        ON CONFLICT ("userId", "dateKey", "workoutId") DO UPDATE
        SET "workoutName" = EXCLUDED."workoutName"
    `;
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
        const completedKeys = completedByUser.get(userPlan.userId) ?? new Set<string>();

        for (const dateKey of eachDateKeyInclusive(startedKey, yesterdayKey)) {
            const planned = getPlannedWorkoutForDate(schedulePlan, parseLogDate(dateKey), { today });
            if (!planned || isRestPlanWorkout(planned)) continue;

            const slotKey = `${dateKey}:${planned.id}`;
            if (completedKeys.has(slotKey)) continue;

            await upsertFrozenScheduledSession(tx, {
                userId: userPlan.userId,
                planId,
                dateKey,
                workoutId: planned.id,
                workoutName: planned.name,
            });
        }
    }
}

/**
 * Freeze every already-due scheduled training slot for this client.
 * Existing rows are never deleted — only missing past dates are inserted.
 * Today and future dates are left to live schedule regeneration.
 */
export async function persistPastDueScheduledSessionsForUser(
    userId: string,
    referenceDate = new Date()
): Promise<{ recovered: number; preserved: number }> {
    try {
        return await persistPastDueScheduledSessionsForUserUnsafe(userId, referenceDate);
    } catch (error) {
        console.error("[persistPastDueScheduledSessionsForUser] failed", userId, error);
        return { recovered: 0, preserved: 0 };
    }
}

async function persistPastDueScheduledSessionsForUserUnsafe(
    userId: string,
    referenceDate = new Date()
): Promise<{ recovered: number; preserved: number }> {
    await ensurePlanMissedSessionHistoryTable();

    const { dateKey: todayKey } = getLocalTimeParts(referenceDate, APP_TIMEZONE);
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const existing = await loadHistoricalMissedSessions(userId);
    const existingSlots = new Set(existing.map((session) => `${session.dateKey}:${session.workoutId}`));

    const [assignments, overrides] = await Promise.all([
        prisma.userPlan.findMany({
            where: { userId },
            orderBy: { startedAt: "asc" },
            include: {
                plan: {
                    include: {
                        weeks: {
                            include: {
                                workouts: {
                                    where: activeWorkoutWhere(),
                                    orderBy: { dayNumber: "asc" },
                                },
                            },
                            orderBy: { weekNumber: "asc" },
                        },
                    },
                },
            },
        }),
        listSessionOverridesForUser(userId),
    ]);

    const revisionsByPlan = await loadPlanScheduleRevisionsByPlanIds(
        assignments.map((assignment) => assignment.planId)
    );
    const today = parseLogDate(todayKey);
    let recovered = 0;
    const assignmentStartKeys = assignments.map((assignment) => toDateKey(assignment.startedAt));

    const freezeWindow = async (
        assignment: (typeof assignments)[number],
        window: { fromKey: string; toKey: string },
        scheduleStartedAt: Date
    ) => {
        const schedulePlan: ActiveUserPlanLike = {
            startedAt: scheduleStartedAt,
            plan: {
                id: assignment.planId,
                weeks: serializePlanWeeksForSchedule(assignment.plan.weeks),
            },
            scheduleRevisions: revisionsByPlan[assignment.planId] ?? [],
        };

        for (const dateKey of eachDateKeyInclusive(window.fromKey, window.toKey)) {
            const planned = getPlannedWorkoutForDate(schedulePlan, parseLogDate(dateKey), {
                today,
                dateKey,
            });
            if (!planned || isRestPlanWorkout(planned)) continue;

            const slotKey = `${dateKey}:${planned.id}`;
            if (existingSlots.has(slotKey)) continue;

            await upsertFrozenScheduledSession(prisma, {
                userId,
                planId: assignment.planId,
                dateKey,
                workoutId: planned.id,
                workoutName: planned.name,
            });
            existingSlots.add(slotKey);
            recovered += 1;
        }
    };

    for (let index = 0; index < assignments.length; index++) {
        const assignment = assignments[index];
        const startedKey = toDateKey(assignment.startedAt);
        const createdKey = toDateKey(assignment.createdAt);
        const nextStart = assignments[index + 1]
            ? toDateKey(assignments[index + 1].startedAt)
            : null;
        const currentWindow = historicalAssignmentWindow(startedKey, nextStart, yesterdayKey);
        if (currentWindow) {
            await freezeWindow(assignment, currentWindow, assignment.startedAt);
        }

        const priorWindow = priorResetAssignmentWindow(
            createdKey,
            startedKey,
            assignmentStartKeys.filter((key) => key !== startedKey),
            yesterdayKey
        );
        if (priorWindow) {
            await freezeWindow(assignment, priorWindow, assignment.createdAt);
        }
    }

    for (const override of overrides) {
        if (override.dateKey > yesterdayKey) continue;
        const slotKey = `${override.dateKey}:${override.baseWorkoutId}`;
        if (existingSlots.has(slotKey)) continue;

        const matchingAssignment = assignments.find((assignment, index) => {
            const nextStart = assignments[index + 1]
                ? toDateKey(assignments[index + 1].startedAt)
                : null;
            const window = historicalAssignmentWindow(
                toDateKey(assignment.startedAt),
                nextStart,
                yesterdayKey
            );
            return Boolean(window && override.dateKey >= window.fromKey && override.dateKey <= window.toKey);
        });

        const planId = matchingAssignment?.planId ?? assignments[0]?.planId ?? null;
        if (!planId) continue;

        await upsertFrozenScheduledSession(prisma, {
            userId,
            planId,
            dateKey: override.dateKey,
            workoutId: override.baseWorkoutId,
            workoutName: override.workoutName?.trim() || "Session",
        });
        existingSlots.add(slotKey);
        recovered += 1;
    }

    return { recovered, preserved: existing.length };
}

export async function loadHistoricalMissedSessions(
    userId: string,
    options?: { planId?: string }
): Promise<HistoricalMissedSession[]> {
    try {
        await ensurePlanMissedSessionHistoryTable();

        const rows = await prisma.$queryRaw<Array<{
            planId: string | null;
            dateKey: string;
            workoutId: string;
            workoutName: string;
        }>>`
            SELECT "planId", "dateKey", "workoutId", "workoutName"
            FROM "plan_missed_session_history"
            WHERE "userId" = ${userId}
            ${options?.planId ? Prisma.sql`AND "planId" = ${options.planId}` : Prisma.empty}
            ORDER BY "dateKey" ASC
        `;

        return rows.map((row) => ({
            planId: row.planId ?? undefined,
            dateKey: row.dateKey,
            workoutId: row.workoutId,
            workoutName: row.workoutName,
        }));
    } catch (error) {
        console.error("[loadHistoricalMissedSessions] failed", userId, error);
        return [];
    }
}

export async function loadHistoricalMissedSessionsByUserIds(
    userIds: string[]
): Promise<Map<string, HistoricalMissedSession[]>> {
    const result = new Map<string, HistoricalMissedSession[]>();
    if (userIds.length === 0) return result;

    try {
        await ensurePlanMissedSessionHistoryTable();

        const rows = await prisma.$queryRaw<Array<{
            userId: string;
            planId: string | null;
            dateKey: string;
            workoutId: string;
            workoutName: string;
        }>>`
            SELECT "userId", "planId", "dateKey", "workoutId", "workoutName"
            FROM "plan_missed_session_history"
            WHERE "userId" IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}`))})
            ORDER BY "dateKey" ASC
        `;

        for (const row of rows) {
            const sessions = result.get(row.userId) ?? [];
            sessions.push({
                planId: row.planId ?? undefined,
                dateKey: row.dateKey,
                workoutId: row.workoutId,
                workoutName: row.workoutName,
            });
            result.set(row.userId, sessions);
        }
    } catch (error) {
        console.error("[loadHistoricalMissedSessionsByUserIds] failed", error);
    }

    return result;
}

/**
 * Historical due sessions belong to the client's training history, not the
 * current assignment window. Never drop other-plan or pre-start rows.
 */
export function filterHistoricalMissedForActivePlan(
    sessions: HistoricalMissedSession[],
    _planId?: string,
    _startedAt?: Date
): HistoricalMissedSession[] {
    return sessions;
}

export function historicalMissedSessionsByDate(
    sessions: HistoricalMissedSession[]
): Map<string, HistoricalMissedSession> {
    return new Map(sessions.map((session) => [session.dateKey, session]));
}
