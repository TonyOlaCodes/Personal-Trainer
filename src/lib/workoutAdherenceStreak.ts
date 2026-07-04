import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { getMondayStart } from "@/lib/calendarCompliance";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { loadPlanScheduleRevisions } from "@/lib/planScheduleHistory";
import { getClientAttentionActions, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
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

function buildScheduledSlots(
    activeUserPlan: ActiveUserPlanLike,
    rangeStart: Date,
    today: Date
): AdherenceSlot[] {
    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(today);
    const slots: AdherenceSlot[] = [];

    for (const dateKey of eachDateKeyInclusive(startKey, endKey)) {
        const day = parseLogDate(dateKey);
        const planned = getPlannedWorkoutForDate(activeUserPlan, day, { today });
        if (!planned) continue;
        if (isRestPlanWorkout(planned)) continue;

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
    excusedKeys?: Set<string>
): number {
    const logSet = new Set(
        completedLogs.map((log) => `${log.dateKey}:${log.workoutId}`)
    );

    let hits = 0;
    for (const slot of slots) {
        const slotKey = `${slot.dateKey}:${slot.workoutId}`;
        slot.completed = logSet.has(slotKey) || (excusedKeys?.has(slotKey) ?? false);
        if (slot.completed) hits++;
    }
    return hits;
}

function computeCurrentStreak(slots: AdherenceSlot[], todayKey: string): number {
    if (slots.length === 0) return 0;

    let evalSlots = slots;
    const last = slots[slots.length - 1];
    if (last.dateKey === todayKey && !last.completed) {
        evalSlots = slots.slice(0, -1);
    }

    let streak = 0;
    for (let i = evalSlots.length - 1; i >= 0; i--) {
        if (evalSlots[i].completed) streak++;
        else break;
    }
    return streak;
}

function computeMaxStreak(slots: AdherenceSlot[], todayKey: string): number {
    const evalSlots = slots.filter(
        (slot) => slot.dateKey !== todayKey || slot.completed
    );

    let max = 0;
    let run = 0;
    for (const slot of evalSlots) {
        if (slot.completed) {
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
    const startedAt = parseLogDate(toDateKey(new Date(activeUserPlan.startedAt)));
    let weekStart = getMondayStart(startedAt);
    const todayKey = toDateKey(today);
    let perfectWeeks = 0;

    while (toDateKey(weekStart) <= todayKey) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const effectiveEnd = weekEnd.getTime() > today.getTime() ? today : weekEnd;

        const weekSlots = buildScheduledSlots(activeUserPlan, weekStart, effectiveEnd);
        if (weekSlots.length > 0) {
            markSlotCompletion(weekSlots, completedLogs, excusedKeys);
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

/** Plan-adherence streak: consecutive scheduled workouts completed; rest days are ignored. */
export function computeWorkoutAdherence(input: WorkoutAdherenceInput): WorkoutAdherenceResult {
    if (!input.activeUserPlan?.plan?.weeks?.length) {
        return EMPTY_RESULT;
    }

    const today =
        input.today
        ?? parseLogDate(getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey);
    const todayKey = toDateKey(today);
    const startedAt = parseLogDate(toDateKey(new Date(input.activeUserPlan.startedAt)));

    if (startedAt.getTime() > today.getTime()) {
        return EMPTY_RESULT;
    }

    const slots = buildScheduledSlots(input.activeUserPlan, startedAt, today);
    const excusedKeys = new Set(input.excusedMissedWorkoutKeys ?? []);
    const scheduledHits = markSlotCompletion(slots, input.completedLogs, excusedKeys);

    return {
        currentStreak: computeCurrentStreak(slots, todayKey),
        maxStreak: computeMaxStreak(slots, todayKey),
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

    const [revisions, logs, clientActions] = await Promise.all([
        loadPlanScheduleRevisions(userPlan.plan.id),
        prisma.workoutLog.findMany({
            where: {
                userId,
                status: "COMPLETED",
                loggedAt: { gte: userPlan.startedAt },
            },
            select: { workoutId: true, loggedAt: true },
        }),
        getClientAttentionActions(userId),
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
    });
}

/** Current plan-adherence streak for profiles and top bar. */
export async function getWorkoutStreak(userId: string): Promise<number> {
    const result = await getWorkoutAdherenceForUser(userId);
    return result.currentStreak;
}
