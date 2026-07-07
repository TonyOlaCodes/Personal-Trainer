import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { getMondayStart } from "@/lib/calendarCompliance";
import {
    getPlannedWorkoutForDate,
    getPlanStartDateKey,
    isDateAfterPlanEnd,
    isDateBeforePlanStart,
    type ActiveUserPlanLike,
} from "@/lib/planSchedule";
import { loadPlanScheduleRevisions } from "@/lib/planScheduleHistory";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import type { HistoricalMissedSession } from "@/lib/planMissedSessionHistory";
import {
    filterHistoricalMissedForActivePlan,
    loadHistoricalMissedSessions,
} from "@/lib/planMissedSessionHistory";
import { prisma } from "@/lib/prisma";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { isRestPlanWorkout } from "@/lib/planTrainingTarget";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface CompletedWorkoutLog {
    workoutId: string;
    dateKey: string;
}

export interface WorkoutAdherenceInput {
    activeUserPlan: ActiveUserPlanLike | null;
    completedLogs: CompletedWorkoutLog[];
    /** `${dateKey}:${workoutId}` keys for coach-excused missed workouts */
    excusedMissedWorkoutKeys?: string[];
    /** Frozen missed sessions from before plan edits */
    historicalMissedSessions?: HistoricalMissedSession[];
    today?: Date;
}

export interface WorkoutAdherenceResult {
    currentStreak: number;
    maxStreak: number;
    perfectWeeks: number;
    scheduledHits: number;
}

const EMPTY_RESULT: WorkoutAdherenceResult = {
    currentStreak: 0,
    maxStreak: 0,
    perfectWeeks: 0,
    scheduledHits: 0,
};

type StreakDayStatus = "kept" | "missed" | "pending";

interface StreakDay {
    dateKey: string;
    status: StreakDayStatus;
}

interface AdherenceSlot {
    dateKey: string;
    workoutId: string;
    completed: boolean;
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

function buildCompletedLogSet(completedLogs: CompletedWorkoutLog[]): Set<string> {
    return new Set(completedLogs.map((log) => `${log.dateKey}:${log.workoutId}`));
}

function collectPlanWorkoutIds(activeUserPlan: ActiveUserPlanLike): Set<string> {
    const ids = new Set<string>();
    for (const week of activeUserPlan.plan.weeks) {
        for (const workout of week.workouts) {
            ids.add(workout.id);
        }
    }
    return ids;
}

function isScheduledWorkoutKept(
    dateKey: string,
    workoutId: string,
    completedLogSet: Set<string>,
    excusedKeys: Set<string>
): boolean {
    const slotKey = `${dateKey}:${workoutId}`;
    return completedLogSet.has(slotKey) || excusedKeys.has(slotKey);
}

/** Past days: accept any completed log for a workout still on the plan (handles plan edits). */
function isTrainingDayKept(
    dateKey: string,
    workoutId: string,
    completedLogs: CompletedWorkoutLog[],
    completedLogSet: Set<string>,
    excusedKeys: Set<string>,
    planWorkoutIds: Set<string>,
    allowLegacySameDayMatch: boolean
): boolean {
    if (isScheduledWorkoutKept(dateKey, workoutId, completedLogSet, excusedKeys)) {
        return true;
    }
    if (!allowLegacySameDayMatch) return false;
    return completedLogs.some(
        (log) => log.dateKey === dateKey && planWorkoutIds.has(log.workoutId)
    );
}

function buildStreakDays(
    activeUserPlan: ActiveUserPlanLike,
    completedLogs: CompletedWorkoutLog[],
    excusedKeys: Set<string>,
    historicalMissedSessions: HistoricalMissedSession[],
    today: Date
): StreakDay[] {
    const todayKey = toDateKey(today);
    const planStartKey = getPlanStartDateKey(activeUserPlan.startedAt);
    if (planStartKey > todayKey) return [];

    const weekCount = activeUserPlan.plan.weeks.length;
    const planWorkoutIds = collectPlanWorkoutIds(activeUserPlan);
    const historicalByDate = new Map(
        historicalMissedSessions.map((session) => [session.dateKey, session] as const)
    );
    const completedLogSet = buildCompletedLogSet(completedLogs);
    const days: StreakDay[] = [];

    for (const dateKey of eachDateKeyInclusive(planStartKey, todayKey)) {
        if (isDateBeforePlanStart(activeUserPlan.startedAt, dateKey)) continue;
        if (isDateAfterPlanEnd(activeUserPlan.startedAt, weekCount, dateKey)) continue;

        const allowLegacy = dateKey < todayKey;
        const day = parseLogDate(dateKey);
        const historical = historicalByDate.get(dateKey);
        if (historical) {
            const kept = isTrainingDayKept(
                dateKey,
                historical.workoutId,
                completedLogs,
                completedLogSet,
                excusedKeys,
                planWorkoutIds,
                allowLegacy
            );
            days.push({
                dateKey,
                status: kept ? "kept" : dateKey === todayKey ? "pending" : "missed",
            });
            continue;
        }

        const planned = getPlannedWorkoutForDate(activeUserPlan, day, { today, dateKey });
        if (!planned || isRestPlanWorkout(planned)) {
            days.push({ dateKey, status: "kept" });
            continue;
        }

        const kept = isTrainingDayKept(
            dateKey,
            planned.id,
            completedLogs,
            completedLogSet,
            excusedKeys,
            planWorkoutIds,
            allowLegacy
        );
        if (dateKey === todayKey) {
            days.push({ dateKey, status: kept ? "kept" : "pending" });
        } else {
            days.push({ dateKey, status: kept ? "kept" : "missed" });
        }
    }

    return days;
}

function buildScheduledSlots(
    activeUserPlan: ActiveUserPlanLike,
    rangeStart: Date,
    today: Date
): AdherenceSlot[] {
    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(today);
    const slots: AdherenceSlot[] = [];

    for (const dateKey of eachDateKeyInclusive(startKey, endKey)) {
        if (isDateBeforePlanStart(activeUserPlan.startedAt, dateKey)) continue;

        const day = parseLogDate(dateKey);
        const planned = getPlannedWorkoutForDate(activeUserPlan, day, { today });
        if (!planned || isRestPlanWorkout(planned)) continue;

        slots.push({
            dateKey,
            workoutId: planned.id,
            completed: false,
        });
    }

    return slots;
}

function markSlotCompletion(
    slots: AdherenceSlot[],
    completedLogs: CompletedWorkoutLog[],
    excusedKeys?: Set<string>,
    planWorkoutIds?: Set<string>
): number {
    const logSet = buildCompletedLogSet(completedLogs);
    let hits = 0;

    for (const slot of slots) {
        const slotKey = `${slot.dateKey}:${slot.workoutId}`;
        const exactMatch = logSet.has(slotKey) || (excusedKeys?.has(slotKey) ?? false);
        const legacyMatch =
            !exactMatch
            && planWorkoutIds
            && completedLogs.some(
                (log) => log.dateKey === slot.dateKey && planWorkoutIds.has(log.workoutId)
            );
        slot.completed = exactMatch || legacyMatch;
        if (slot.completed) hits++;
    }

    return hits;
}

function streakDaysForEvaluation(days: StreakDay[], todayKey: string): StreakDay[] {
    if (days.length === 0) return days;
    const last = days[days.length - 1];
    if (last.dateKey === todayKey && last.status === "pending") {
        return days.slice(0, -1);
    }
    return days;
}

/** Consecutive calendar days kept: completed scheduled workout or planned rest; breaks on missed workouts only. */
export function computeCurrentStreak(days: StreakDay[], todayKey: string): number {
    const evalDays = streakDaysForEvaluation(days, todayKey);
    let streak = 0;

    for (let i = evalDays.length - 1; i >= 0; i--) {
        if (evalDays[i].status === "kept") {
            streak++;
            continue;
        }
        break;
    }

    return streak;
}

export function computeMaxStreak(days: StreakDay[], todayKey: string): number {
    const evalDays = streakDaysForEvaluation(days, todayKey);
    let max = 0;
    let run = 0;

    for (const day of evalDays) {
        if (day.status === "kept") {
            run++;
            max = Math.max(max, run);
        } else {
            run = 0;
        }
    }

    return max;
}

function computePerfectWeeks(
    activeUserPlan: ActiveUserPlanLike,
    completedLogs: CompletedWorkoutLog[],
    today: Date,
    excusedKeys?: Set<string>
): number {
    const startedAt = parseLogDate(getPlanStartDateKey(activeUserPlan.startedAt));
    let weekStart = getMondayStart(startedAt);
    const todayKey = toDateKey(today);
    let perfectWeeks = 0;

    while (toDateKey(weekStart) <= todayKey) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const effectiveEnd = weekEnd.getTime() > today.getTime() ? today : weekEnd;

        const weekSlots = buildScheduledSlots(activeUserPlan, weekStart, effectiveEnd);
        if (weekSlots.length > 0) {
            const planWorkoutIds = collectPlanWorkoutIds(activeUserPlan);
            markSlotCompletion(weekSlots, completedLogs, excusedKeys, planWorkoutIds);
            const pendingToday = weekSlots.some(
                (slot) => slot.dateKey === todayKey && !slot.completed
            );
            const evalSlots =
                pendingToday
                    ? weekSlots.filter((slot) => slot.dateKey !== todayKey)
                    : weekSlots;

            if (
                evalSlots.length > 0
                && evalSlots.every((slot) => slot.completed)
            ) {
                perfectWeeks++;
            }
        }

        weekStart = new Date(weekStart);
        weekStart.setDate(weekStart.getDate() + 7);
    }

    return perfectWeeks;
}

/** Plan-adherence streak: +1 per day when a scheduled workout is completed or the day is a planned rest; resets on missed workouts. */
export function computeWorkoutAdherence(input: WorkoutAdherenceInput): WorkoutAdherenceResult {
    if (!input.activeUserPlan?.plan?.weeks?.length) {
        return EMPTY_RESULT;
    }

    const today =
        input.today
        ?? parseLogDate(getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey);
    const todayKey = toDateKey(today);
    const startedAt = parseLogDate(getPlanStartDateKey(input.activeUserPlan.startedAt));

    if (startedAt.getTime() > today.getTime()) {
        return EMPTY_RESULT;
    }

    const planWorkoutIds = collectPlanWorkoutIds(input.activeUserPlan);
    const excusedKeys = new Set(input.excusedMissedWorkoutKeys ?? []);
    const historicalMissedSessions = filterHistoricalMissedForActivePlan(
        input.historicalMissedSessions ?? [],
        input.activeUserPlan.plan.id,
        input.activeUserPlan.startedAt
    );
    const streakDays = buildStreakDays(
        input.activeUserPlan,
        input.completedLogs,
        excusedKeys,
        historicalMissedSessions,
        today
    );
    const slots = buildScheduledSlots(input.activeUserPlan, startedAt, today);
    const scheduledHits = markSlotCompletion(
        slots,
        input.completedLogs,
        excusedKeys,
        planWorkoutIds
    );

    return {
        currentStreak: computeCurrentStreak(streakDays, todayKey),
        maxStreak: computeMaxStreak(streakDays, todayKey),
        perfectWeeks: computePerfectWeeks(
            input.activeUserPlan,
            input.completedLogs,
            today,
            excusedKeys
        ),
        scheduledHits,
    };
}

function toCompletedLogRows(
    logs: Array<{ workoutId: string; loggedAt: Date }>
): CompletedWorkoutLog[] {
    return logs.map((log) => ({
        workoutId: log.workoutId,
        dateKey: getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey,
    }));
}

export async function getWorkoutAdherenceForUser(userId: string): Promise<WorkoutAdherenceResult> {
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

    if (!userPlan?.plan) {
        return EMPTY_RESULT;
    }

    const planStartDate = parseLogDate(getPlanStartDateKey(userPlan.startedAt));

    const [revisions, logs, clientActions, historicalMissedSessions] = await Promise.all([
        loadPlanScheduleRevisions(userPlan.plan.id),
        prisma.workoutLog.findMany({
            where: {
                userId,
                status: "COMPLETED",
                loggedAt: { gte: planStartDate },
            },
            select: { workoutId: true, loggedAt: true },
        }),
        getClientAttentionActions(userId),
        loadHistoricalMissedSessions(userId, { planId: userPlan.plan.id }),
    ]);

    const excusedMissedWorkoutKeys = [...getExcusedMissedWorkoutKeys(clientActions)];

    return computeWorkoutAdherence({
        activeUserPlan: {
            startedAt: userPlan.startedAt,
            plan: userPlan.plan,
            scheduleRevisions: revisions,
        },
        completedLogs: toCompletedLogRows(logs),
        excusedMissedWorkoutKeys,
        historicalMissedSessions,
    });
    } catch (error) {
        console.error("[getWorkoutAdherenceForUser] Failed for user", userId, error);
        return EMPTY_RESULT;
    }
}

/** Current plan-adherence streak for profiles, dashboard, and progress. */
export async function getWorkoutStreak(userId: string): Promise<number> {
    const result = await getWorkoutAdherenceForUser(userId);
    return result.currentStreak;
}
