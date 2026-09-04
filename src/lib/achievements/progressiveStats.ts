import { APP_TIMEZONE } from "@/lib/appTimezone";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import {
    computeComplianceForMonth,
    getMonthStart,
    isFutureCalendarMonth,
} from "@/lib/calendarCompliance";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { ensureDailyMetricsTable } from "@/lib/dailyMetrics";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import {
    applySetToRecords,
    cloneExerciseRecords,
    EMPTY_EXERCISE_RECORDS,
    evaluateSetPr,
    type ExerciseRecords,
} from "@/lib/exercisePrs";
import {
    getPlanStartDateKey,
} from "@/lib/planSchedule";
import { loadPlanScheduleRevisions } from "@/lib/planScheduleHistory";
import { loadHistoricalMissedSessions } from "@/lib/planMissedSessionHistory";
import { isRestPlanWorkout } from "@/lib/planTrainingTarget";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { prisma } from "@/lib/prisma";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { getWorkoutAdherenceForUser } from "@/lib/workoutAdherenceStreak";

export interface ProgressiveAchievementStats {
    workoutsCompleted: number;
    currentStreakDays: number;
    bestStreakDays: number;
    prCount: number;
    checkIns: number;
    bodyweightDays: number;
    trainingHours: number;
    completedSets: number;
    perfectWeeks: number;
    dailyTargetDays: number;
    uniqueExercises: number;
    loggedExerciseEntries: number;
    plansCreated: number;
    plansCopiedFromUser: number;
    messagesSent: number;
    activeMonths: number;
    checkInBestStreak: number;
    checkInCurrentStreak: number;
    prVariety: number;
    trainingDays: number;
    workoutVariety: number;
    hasCompletedWorkout: boolean;
    hasCheckIn: boolean;
    hasPr: boolean;
    hasWeightPr: boolean;
    hasRepPr: boolean;
    hasEstimated1RM: boolean;
    onboardingDone: boolean;
    hasCreatedPlan: boolean;
    hasPublicPlan: boolean;
    hasPlanCopiedFromUser: boolean;
    hasPerfectMonth: boolean;
    hasFlawless100: boolean;
    hasOneYearStrong: boolean;
    hasComeback: boolean;
    hasVolumeDay: boolean;
    hasEarlyBird: boolean;
    canCreatePlans: boolean;
    accountAgeDays: number;
}

const MS_PER_DAY = 86400000;
const CHECK_IN_GAP_MS = 10 * MS_PER_DAY;

function monthKeyFromDate(date: Date): string {
    const { year, month } = getLocalTimeParts(date, APP_TIMEZONE);
    return `${year}-${String(month).padStart(2, "0")}`;
}

function monthKeyFromLoggedDate(value: Date | string): string {
    if (typeof value === "string") {
        const key = value.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(key)) return key;
    }
    return monthKeyFromDate(value instanceof Date ? value : new Date(value));
}

/** Longest / current check-in streak using gap ≤ 10 days between submissions. */
export function computeCheckInStreaks(
    checkInDates: Date[],
    now = new Date()
): { best: number; current: number } {
    if (checkInDates.length === 0) return { best: 0, current: 0 };

    const sorted = [...checkInDates].sort((a, b) => a.getTime() - b.getTime());
    let best = 1;
    let run = 1;

    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].getTime() - sorted[i - 1].getTime();
        if (gap <= CHECK_IN_GAP_MS) {
            run++;
            best = Math.max(best, run);
        } else {
            run = 1;
        }
    }

    const last = sorted[sorted.length - 1];
    let current = 0;
    if (now.getTime() - last.getTime() <= CHECK_IN_GAP_MS) {
        current = 1;
        for (let i = sorted.length - 1; i >= 1; i--) {
            const gap = sorted[i].getTime() - sorted[i - 1].getTime();
            if (gap <= CHECK_IN_GAP_MS) current++;
            else break;
        }
    }

    return { best, current };
}

function detectComeback(completedAt: Date[]): boolean {
    if (completedAt.length < 2) return false;
    const sorted = [...completedAt].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
        const gapDays = (sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_DAY;
        if (gapDays >= 14) return true;
    }
    return false;
}

async function countNonEmptyUserPlans(userId: string): Promise<number> {
    const plans = await prisma.plan.findMany({
        where: { creatorId: userId, type: "USER_CREATED" },
        select: {
            id: true,
            weeks: {
                select: {
                    workouts: {
                        select: {
                            name: true,
                            exercises: { select: { id: true } },
                        },
                    },
                },
            },
        },
    });

    return plans.filter((plan) =>
        plan.weeks.some((week) =>
            week.workouts.some((workout) => !isRestPlanWorkout(workout))
        )
    ).length;
}

async function countDistinctPlanCopiers(userId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "creatorId")::bigint AS count
        FROM "plans"
        WHERE "originalCreatorId" = ${userId}
          AND "creatorId" IS NOT NULL
          AND "creatorId" <> ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
}

async function computeHasPerfectMonth(userId: string): Promise<boolean> {
    try {
        const userPlan = await prisma.userPlan.findFirst({
            where: { userId, isActive: true },
            select: {
                startedAt: true,
                plan: {
                    select: {
                        id: true,
                        weeks: {
                            orderBy: { weekNumber: "asc" },
                            select: {
                                weekNumber: true,
                                workouts: {
                                    where: activeWorkoutWhere(),
                                    orderBy: { dayNumber: "asc" },
                                    select: {
                                        id: true,
                                        name: true,
                                        dayNumber: true,
                                        dayOfWeek: true,
                                        exercises: { select: { id: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!userPlan?.plan?.weeks?.length) return false;

        const planStart = parseLogDate(getPlanStartDateKey(userPlan.startedAt));
        const today = parseLogDate(getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey);

        const [revisions, logs, clientActions, historicalMissedSessions] = await Promise.all([
            loadPlanScheduleRevisions(userPlan.plan.id),
            prisma.workoutLog.findMany({
                where: {
                    userId,
                    status: "COMPLETED",
                    loggedAt: { gte: planStart },
                },
                select: { workoutId: true, loggedAt: true },
            }),
            getClientAttentionActions(userId),
            loadHistoricalMissedSessions(userId, { planId: userPlan.plan.id }),
        ]);

        const input = {
            activePlan: { weeks: userPlan.plan.weeks },
            planStartedAt: userPlan.startedAt.toISOString(),
            loggedDates: logs.map((log) => ({
                date: getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey,
                workoutId: log.workoutId,
            })),
            scheduleRevisions: revisions,
            excusedMissedWorkoutKeys: [...getExcusedMissedWorkoutKeys(clientActions)],
            historicalMissedSessions,
        };

        let cursor = getMonthStart(planStart);
        while (!isFutureCalendarMonth(today, cursor.getUTCFullYear(), cursor.getUTCMonth())) {
            const year = cursor.getUTCFullYear();
            const monthIndex = cursor.getUTCMonth();
            const isCurrent = year === today.getUTCFullYear() && monthIndex === today.getUTCMonth();

            if (!isCurrent) {
                const result = computeComplianceForMonth(input, year, monthIndex, today);
                if (result.due > 0 && result.completed === result.due) {
                    return true;
                }
            }

            cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
        }

        return false;
    } catch (err) {
        console.error("[progressiveStats] hasPerfectMonth failed", userId, err);
        return false;
    }
}

/**
 * Replay completed working sets chronologically to detect weight / rep PR kinds.
 * Caps to a reasonable volume for sync; falls back to isPR flags if empty.
 */
function detectPrKinds(
    sets: Array<{
        exerciseName: string | null;
        weightKg: number | null;
        reps: number | null;
        isWarmup: boolean;
        isCompleted: boolean;
        isPR: boolean;
        loggedAt: Date;
        setNumber: number;
    }>
): { hasWeightPr: boolean; hasRepPr: boolean; hasEstimated1RM: boolean } {
    const recordsByKey = new Map<string, ExerciseRecords>();
    let hasWeightPr = false;
    let hasRepPr = false;
    let hasEstimated1RM = false;

    for (const set of sets) {
        if (set.isWarmup || !set.isCompleted) continue;

        const key = exerciseIdentityKey(set.exerciseName);
        if (!key) continue;

        let records = recordsByKey.get(key);
        if (!records) {
            records = cloneExerciseRecords(EMPTY_EXERCISE_RECORDS);
            recordsByKey.set(key, records);
        }

        const result = evaluateSetPr(set, records);
        if (result.kinds.includes("weight")) hasWeightPr = true;
        if (result.kinds.includes("reps")) hasRepPr = true;
        if (result.kinds.includes("oneRm")) hasEstimated1RM = true;

        applySetToRecords(records, set);
    }

    return { hasWeightPr, hasRepPr, hasEstimated1RM };
}

export async function getProgressiveAchievementStats(
    userId: string
): Promise<ProgressiveAchievementStats> {
    await Promise.all([ensureBodyweightTable(), ensureDailyMetricsTable()]);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, onboardingDone: true },
    });

    const accountAgeDays = user
        ? Math.floor((Date.now() - user.createdAt.getTime()) / MS_PER_DAY)
        : 0;

    const [
        workoutsCompleted,
        checkIns,
        prCount,
        bodyweightDaysRows,
        completedSets,
        trainingAgg,
        dailyTargetDaysRows,
        messagesSent,
        plansCreated,
        plansCopiedFromUser,
        publicPlans,
        checkInRows,
        completedLogs,
        workingSets,
        volumeDayRows,
        adherence,
        hasPerfectMonth,
    ] = await Promise.all([
        prisma.workoutLog.count({ where: { userId, status: "COMPLETED" } }),
        prisma.checkIn.count({ where: { userId } }),
        prisma.logSet.count({
            where: { isPR: true, workoutLog: { userId, status: "COMPLETED" } },
        }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
        `,
        prisma.logSet.count({
            where: {
                isWarmup: false,
                isCompleted: true,
                workoutLog: { userId, status: "COMPLETED" },
            },
        }),
        prisma.workoutLog.aggregate({
            where: { userId, status: "COMPLETED", duration: { not: null } },
            _sum: { duration: true },
        }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "daily_metric_logs"
            WHERE "userId" = ${userId}
        `,
        prisma.message.count({
            where: {
                senderId: userId,
                isGeneral: false,
                NOT: { receiverId: userId },
            },
        }),
        countNonEmptyUserPlans(userId),
        countDistinctPlanCopiers(userId),
        prisma.plan.count({
            where: { creatorId: userId, type: "USER_CREATED", isPublic: true },
        }),
        prisma.checkIn.findMany({
            where: { userId },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
        }),
        prisma.workoutLog.findMany({
            where: { userId, status: "COMPLETED" },
            select: { id: true, workoutId: true, loggedAt: true },
            orderBy: { loggedAt: "asc" },
        }),
        prisma.logSet.findMany({
            where: {
                isWarmup: false,
                isCompleted: true,
                workoutLog: { userId, status: "COMPLETED" },
            },
            select: {
                exerciseName: true,
                exerciseId: true,
                weightKg: true,
                reps: true,
                isWarmup: true,
                isCompleted: true,
                isPR: true,
                setNumber: true,
                workoutLogId: true,
                workoutLog: { select: { loggedAt: true } },
            },
            orderBy: [{ workoutLog: { loggedAt: "asc" } }, { setNumber: "asc" }],
        }),
        prisma.$queryRaw<Array<{ workoutLogId: string; setCount: bigint }>>`
            SELECT ls."workoutLogId", COUNT(*)::bigint AS "setCount"
            FROM "log_sets" ls
            INNER JOIN "workout_logs" wl ON wl."id" = ls."workoutLogId"
            WHERE wl."userId" = ${userId}
              AND wl."status" = 'COMPLETED'
              AND ls."isWarmup" = false
              AND ls."isCompleted" = true
            GROUP BY ls."workoutLogId"
            HAVING COUNT(*) >= 20
            LIMIT 1
        `,
        getWorkoutAdherenceForUser(userId),
        computeHasPerfectMonth(userId),
    ]);

    const bodyweightDays = Number(bodyweightDaysRows[0]?.count ?? 0);
    const dailyTargetDays = Number(dailyTargetDaysRows[0]?.count ?? 0);
    const trainingMinutes = trainingAgg._sum.duration ?? 0;
    const trainingHours = trainingMinutes / 60;

    const checkInStreaks = computeCheckInStreaks(checkInRows.map((r) => r.createdAt));

    const uniqueExerciseKeys = new Set<string>();
    const loggedEntryKeys = new Set<string>();
    const prVarietyKeys = new Set<string>();

    for (const set of workingSets) {
        const key = exerciseIdentityKey(set.exerciseName);
        if (!key) continue;
        uniqueExerciseKeys.add(key);
        loggedEntryKeys.add(`${set.workoutLogId}:${key}`);
        if (set.isPR) prVarietyKeys.add(key);
    }

    const trainingDayKeys = new Set(
        completedLogs.map((log) => getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey)
    );
    const workoutVarietyKeys = new Set(completedLogs.map((log) => log.workoutId));

    const activeMonthKeys = new Set<string>();
    for (const log of completedLogs) {
        activeMonthKeys.add(monthKeyFromDate(log.loggedAt));
    }
    for (const row of checkInRows) {
        activeMonthKeys.add(monthKeyFromDate(row.createdAt));
    }

    const [bwMonthRows, dmMonthRows] = await Promise.all([
        prisma.$queryRaw<Array<{ loggedDate: Date }>>`
            SELECT "loggedDate" FROM "bodyweight_logs" WHERE "userId" = ${userId}
        `,
        prisma.$queryRaw<Array<{ loggedDate: Date }>>`
            SELECT "loggedDate" FROM "daily_metric_logs" WHERE "userId" = ${userId}
        `,
    ]);
    for (const row of bwMonthRows) {
        activeMonthKeys.add(monthKeyFromLoggedDate(row.loggedDate));
    }
    for (const row of dmMonthRows) {
        activeMonthKeys.add(monthKeyFromLoggedDate(row.loggedDate));
    }

    const prKinds = detectPrKinds(
        workingSets.map((s) => ({
            exerciseName: s.exerciseName,
            weightKg: s.weightKg,
            reps: s.reps,
            isWarmup: s.isWarmup,
            isCompleted: s.isCompleted,
            isPR: s.isPR,
            loggedAt: s.workoutLog.loggedAt,
            setNumber: s.setNumber,
        }))
    );

    const hasComeback = detectComeback(completedLogs.map((l) => l.loggedAt));
    const hasVolumeDay = volumeDayRows.length > 0;
    const hasEarlyBird = completedLogs.some((log) => {
        try {
            return getLocalTimeParts(log.loggedAt, APP_TIMEZONE).hour < 7;
        } catch {
            return log.loggedAt.getUTCHours() < 7;
        }
    });

    const bestStreakDays = adherence.maxStreak;
    const activeMonths = activeMonthKeys.size;

    return {
        workoutsCompleted,
        currentStreakDays: adherence.currentStreak,
        bestStreakDays,
        prCount,
        checkIns,
        bodyweightDays,
        trainingHours,
        completedSets,
        perfectWeeks: adherence.perfectWeeks,
        dailyTargetDays,
        uniqueExercises: uniqueExerciseKeys.size,
        loggedExerciseEntries: loggedEntryKeys.size,
        plansCreated,
        plansCopiedFromUser,
        messagesSent,
        activeMonths,
        checkInBestStreak: checkInStreaks.best,
        checkInCurrentStreak: checkInStreaks.current,
        prVariety: prVarietyKeys.size,
        trainingDays: trainingDayKeys.size,
        workoutVariety: workoutVarietyKeys.size,
        hasCompletedWorkout: workoutsCompleted > 0,
        hasCheckIn: checkIns > 0,
        hasPr: prCount > 0,
        hasWeightPr: prKinds.hasWeightPr,
        hasRepPr: prKinds.hasRepPr,
        hasEstimated1RM: prKinds.hasEstimated1RM,
        onboardingDone: user?.onboardingDone ?? false,
        hasCreatedPlan: plansCreated > 0,
        hasPublicPlan: publicPlans > 0,
        hasPlanCopiedFromUser: plansCopiedFromUser > 0,
        hasPerfectMonth,
        hasFlawless100: bestStreakDays >= 100,
        hasOneYearStrong: activeMonths >= 12,
        hasComeback,
        hasVolumeDay,
        hasEarlyBird,
        canCreatePlans: true,
        accountAgeDays,
    };
}
