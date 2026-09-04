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
import { isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import { dateKeyToUtcNoon } from "@/lib/appTimezone";
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

/**
 * Streak semantics (one definition, used everywhere):
 *
 *   completed — a workout was completed that day. Increments the streak.
 *   carry     — planned rest, or a coach-excused missed session. Keeps the chain
 *               alive but does not increment, so rest days cannot inflate a streak.
 *   pending   — today's scheduled workout is not done yet. Keeps the chain alive
 *               until the day is over.
 *   missed    — a scheduled workout was not completed and was not excused, or the
 *               day falls outside any active plan. Breaks the chain immediately.
 *   neutral   — before the user's first ever completed workout. Ignored.
 *
 * Because days after a plan ends count as `missed`, a single old completed workout
 * can never hold a streak open indefinitely.
 */
type StreakDayStatus = "completed" | "carry" | "missed" | "pending" | "neutral";

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

/**
 * True when the user trained on this calendar day.
 *
 * Scheduled training days require the matching workout id (Edit Session keeps
 * that id). Rest days still count any completed plan workout as catch-up.
 */
function didTrainOnDay(
    dateKey: string,
    completedLogs: CompletedWorkoutLog[],
    planWorkoutIds: Set<string>,
    scheduledWorkoutId: string | null
): boolean {
    if (scheduledWorkoutId) {
        return completedLogs.some(
            (log) => log.dateKey === dateKey && log.workoutId === scheduledWorkoutId
        );
    }
    return completedLogs.some(
        (log) => log.dateKey === dateKey && planWorkoutIds.has(log.workoutId)
    );
}

/** Earliest calendar day the user completed a plan workout; the streak cannot start before this. */
function findFirstCompletedWorkoutDateKey(
    activeUserPlan: ActiveUserPlanLike,
    completedLogs: CompletedWorkoutLog[],
    today: Date
): string | null {
    const todayKey = toDateKey(today);
    const planWorkoutIds = collectPlanWorkoutIds(activeUserPlan);

    const trainingDays = completedLogs
        .filter((log) => planWorkoutIds.has(log.workoutId) && log.dateKey <= todayKey)
        .map((log) => log.dateKey)
        .sort();

    return trainingDays[0] ?? null;
}

/**
 * One status per calendar day from the user's first completed workout up to today.
 *
 * Every day in the window gets a status — including days after the plan ended, which
 * are `missed`. That is what stops an old completed workout from showing a streak
 * forever after the user goes inactive.
 */
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

    const firstCompletedKey = findFirstCompletedWorkoutDateKey(activeUserPlan, completedLogs, today);
    if (firstCompletedKey === null) return [];

    const weekCount = activeUserPlan.plan.weeks.length;
    const planWorkoutIds = collectPlanWorkoutIds(activeUserPlan);
    const historicalByDate = new Map(
        historicalMissedSessions.map((session) => [session.dateKey, session] as const)
    );
    const days: StreakDay[] = [];

    for (const dateKey of eachDateKeyInclusive(planStartKey, todayKey)) {
        if (isDateBeforePlanStart(activeUserPlan.startedAt, dateKey)) continue;

        if (dateKey < firstCompletedKey) {
            days.push({ dateKey, status: "neutral" });
            continue;
        }

        const historical = historicalByDate.get(dateKey);
        const scheduledWorkoutId = isDateAfterPlanEnd(activeUserPlan.startedAt, weekCount, dateKey)
            ? null
            : historical
                ? historical.workoutId
                : resolveScheduledTrainingWorkoutId(activeUserPlan, dateKey, today);

        // Matching scheduled work, or any plan workout on a rest / post-plan day.
        if (didTrainOnDay(dateKey, completedLogs, planWorkoutIds, scheduledWorkoutId)) {
            days.push({ dateKey, status: "completed" });
            continue;
        }

        if (isDateAfterPlanEnd(activeUserPlan.startedAt, weekCount, dateKey)) {
            days.push({ dateKey, status: "missed" });
            continue;
        }

        if (!scheduledWorkoutId) {
            days.push({ dateKey, status: "carry" });
            continue;
        }

        if (excusedKeys.has(`${dateKey}:${scheduledWorkoutId}`)) {
            days.push({ dateKey, status: "carry" });
            continue;
        }

        days.push({ dateKey, status: dateKey === todayKey ? "pending" : "missed" });
    }

    return days;
}

/** The scheduled training workout for a day, or null when the day is rest or unscheduled. */
function resolveScheduledTrainingWorkoutId(
    activeUserPlan: ActiveUserPlanLike,
    dateKey: string,
    today: Date
): string | null {
    const planned = getPlannedWorkoutForDate(activeUserPlan, parseLogDate(dateKey), { today, dateKey });
    if (!planned || !isScheduledTrainingWorkout(planned)) return null;
    return planned.id;
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
        if (!planned || !isScheduledTrainingWorkout(planned)) continue;

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
    const logSet = buildCompletedLogSet(completedLogs);
    let hits = 0;

    for (const slot of slots) {
        const slotKey = `${slot.dateKey}:${slot.workoutId}`;
        slot.completed = logSet.has(slotKey) || (excusedKeys?.has(slotKey) ?? false);
        if (slot.completed) hits++;
    }

    return hits;
}

/**
 * Today's unfinished workout must not break the streak before the day is over, so a
 * trailing `pending` day is dropped rather than evaluated.
 */
function streakDaysForEvaluation(days: StreakDay[], todayKey: string): StreakDay[] {
    if (days.length === 0) return days;
    const last = days[days.length - 1];
    if (last.dateKey === todayKey && last.status === "pending") {
        return days.slice(0, -1);
    }
    return days;
}

/**
 * Days trained in the current unbroken chain.
 *
 * Walks back from today: completed days count, rest and excused days are stepped over
 * without counting, and the first missed day ends the walk.
 */
export function computeCurrentStreak(days: StreakDay[], todayKey: string): number {
    const evalDays = streakDaysForEvaluation(days, todayKey);
    let streak = 0;

    for (let i = evalDays.length - 1; i >= 0; i--) {
        const status = evalDays[i].status;
        if (status === "missed") break;
        if (status === "completed") streak++;
    }

    return streak;
}

/** Longest chain of trained days that was never broken by a missed day. */
export function computeMaxStreak(days: StreakDay[], todayKey: string): number {
    const evalDays = streakDaysForEvaluation(days, todayKey);
    let max = 0;
    let run = 0;

    for (const day of evalDays) {
        if (day.status === "missed") {
            run = 0;
            continue;
        }
        if (day.status === "completed") {
            run++;
            max = Math.max(max, run);
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
    let weekStartKey = toDateKey(getMondayStart(startedAt));
    const todayKey = toDateKey(today);
    let perfectWeeks = 0;

    while (weekStartKey <= todayKey) {
        const weekStart = getMondayStart(dateKeyToUtcNoon(weekStartKey));
        const weekEndKey = addDaysToDateKey(weekStartKey, 6);
        const weekEnd = dateKeyToUtcNoon(weekEndKey);
        const effectiveEnd = weekEndKey > todayKey ? today : weekEnd;

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

        weekStartKey = addDaysToDateKey(weekStartKey, 7);
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

    const excusedKeys = new Set(input.excusedMissedWorkoutKeys ?? []);
    const historicalMissedSessions = filterHistoricalMissedForActivePlan(
        input.historicalMissedSessions ?? [],
        input.activeUserPlan.plan.id ?? "",
        startedAt
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
        excusedKeys
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

/** Lightweight scenario checks for CI; returns failing case labels. */
export function runStreakScenarioChecks(): string[] {
    const failures: string[] = [];
    const planStart = "2026-01-05"; // Monday

    const basePlan: ActiveUserPlanLike = {
        startedAt: new Date(`${planStart}T12:00:00Z`),
        plan: {
            weeks: [
                {
                    weekNumber: 1,
                    workouts: [
                        { id: "w-mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                        { id: "w-tue", name: "Rest", dayNumber: 2, dayOfWeek: 1, exercises: [] },
                        { id: "w-wed", name: "Pull", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e2" }] },
                        { id: "w-thu", name: "Rest", dayNumber: 4, dayOfWeek: 3, exercises: [] },
                        { id: "w-fri", name: "Legs", dayNumber: 5, dayOfWeek: 4, exercises: [{ id: "e3" }] },
                    ],
                },
            ],
        },
        scheduleRevisions: [],
    };

    const streakFor = (
        input: Partial<Omit<WorkoutAdherenceInput, "activeUserPlan" | "today">> & { todayKey: string }
    ) =>
        computeWorkoutAdherence({
            activeUserPlan: basePlan,
            completedLogs: input.completedLogs ?? [],
            excusedMissedWorkoutKeys: input.excusedMissedWorkoutKeys,
            historicalMissedSessions: input.historicalMissedSessions,
            today: parseLogDate(input.todayKey),
        }).currentStreak;

    const expect = (name: string, actual: number, expected: number) => {
        if (actual !== expected) failures.push(`${name}: expected ${expected}, got ${actual}`);
    };

    // 1. New user with no workouts
    expect("no workouts", streakFor({ todayKey: "2026-01-07" }), 0);

    // 2. First workout completed
    expect(
        "first workout completed",
        streakFor({
            todayKey: "2026-01-05",
            completedLogs: [{ dateKey: "2026-01-05", workoutId: "w-mon" }],
        }),
        1
    );

    // 3. A rest day keeps the chain alive without inflating it
    expect(
        "rest day does not inflate",
        streakFor({
            todayKey: "2026-01-06",
            completedLogs: [{ dateKey: "2026-01-05", workoutId: "w-mon" }],
        }),
        1
    );

    // 4. Two training days completed with a rest day between them
    expect(
        "two completed days",
        streakFor({
            todayKey: "2026-01-07",
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-07", workoutId: "w-wed" },
            ],
        }),
        2
    );

    // 5. Scheduled workout missed with no completion history
    expect("missed workout before first completion", streakFor({ todayKey: "2026-01-06" }), 0);

    // 6. Coach-excused missed workout keeps the chain without adding to it
    expect(
        "excused missed workout keeps chain",
        streakFor({
            todayKey: "2026-01-08",
            completedLogs: [{ dateKey: "2026-01-05", workoutId: "w-mon" }],
            excusedMissedWorkoutKeys: ["2026-01-07:w-wed"],
        }),
        1
    );

    // 7. Excused day bridges two completed days
    expect(
        "excused day bridges training",
        streakFor({
            todayKey: "2026-01-09",
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-09", workoutId: "w-fri" },
            ],
            excusedMissedWorkoutKeys: ["2026-01-07:w-wed"],
        }),
        2
    );

    // 8. Multiple rest days between workouts must not inflate the streak
    const restHeavyPlan: ActiveUserPlanLike = {
        ...basePlan,
        plan: {
            weeks: [
                {
                    weekNumber: 1,
                    workouts: [
                        { id: "w-mon", name: "Push", dayNumber: 1, dayOfWeek: 1, exercises: [{ id: "e1" }] },
                        { id: "w-tue", name: "Rest", dayNumber: 2, dayOfWeek: 2, exercises: [] },
                        { id: "w-wed", name: "Rest Day", dayNumber: 3, dayOfWeek: 3, exercises: [] },
                        { id: "w-thu", name: "Rest", dayNumber: 4, dayOfWeek: 4, exercises: [] },
                        { id: "w-fri", name: "Legs", dayNumber: 5, dayOfWeek: 5, exercises: [{ id: "e3" }] },
                    ],
                },
            ],
        },
    };
    expect(
        "rest days between workouts",
        computeWorkoutAdherence({
            activeUserPlan: restHeavyPlan,
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-09", workoutId: "w-fri" },
            ],
            today: parseLogDate("2026-01-09"),
        }).currentStreak,
        2
    );

    // 9. Today's scheduled workout still pending should not count yet
    expect(
        "pending today excluded",
        streakFor({
            todayKey: "2026-01-05",
            completedLogs: [],
        }),
        0
    );

    // 10. Deleted / removed logs recalculate to zero
    expect(
        "deleted logs",
        streakFor({
            todayKey: "2026-01-07",
            completedLogs: [],
        }),
        0
    );

    // 11. A missed day breaks the chain even with workouts either side of it
    expect(
        "missed day breaks chain",
        streakFor({
            todayKey: "2026-01-09",
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-09", workoutId: "w-fri" },
            ],
        }),
        1
    );

    // 12. Weeks of inactivity after one old workout must reset to zero
    expect(
        "long inactivity resets to zero",
        streakFor({
            todayKey: "2026-01-20",
            completedLogs: [{ dateKey: "2026-01-05", workoutId: "w-mon" }],
        }),
        0
    );

    // 13. One workout after a long lay-off counts as exactly one
    expect(
        "single workout after inactivity",
        streakFor({
            todayKey: "2026-01-19",
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-19", workoutId: "w-mon" },
            ],
        }),
        1
    );

    // 14. Training on an unscheduled rest day still counts
    expect(
        "workout logged on a rest day counts",
        streakFor({
            todayKey: "2026-01-06",
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "w-mon" },
                { dateKey: "2026-01-06", workoutId: "w-mon" },
            ],
        }),
        2
    );

    // 15. Completing a different plan workout on a scheduled day does not complete that slot
    expect(
        "wrong workout on scheduled day is missed",
        streakFor({
            todayKey: "2026-01-06",
            completedLogs: [{ dateKey: "2026-01-05", workoutId: "w-fri" }],
        }),
        0
    );

    // 16. A finished multi-week plan must not hold a streak open forever
    const finishedPlan: ActiveUserPlanLike = {
        startedAt: new Date("2026-01-05T12:00:00Z"),
        plan: {
            weeks: [
                {
                    weekNumber: 1,
                    workouts: [
                        { id: "p1-mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                    ],
                },
                {
                    weekNumber: 2,
                    workouts: [
                        { id: "p2-mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                    ],
                },
            ],
        },
        scheduleRevisions: [],
    };
    expect(
        "streak resets after plan ends",
        computeWorkoutAdherence({
            activeUserPlan: finishedPlan,
            completedLogs: [
                { dateKey: "2026-01-05", workoutId: "p1-mon" },
                { dateKey: "2026-01-12", workoutId: "p2-mon" },
            ],
            today: parseLogDate("2026-02-02"),
        }).currentStreak,
        0
    );

    return failures;
}
