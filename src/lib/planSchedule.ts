import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import {
    resolveScheduleWeeksForDate,
    type PlanScheduleRevisionRecord,
} from "@/lib/planScheduleHistory";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { activeWorkoutWhere } from "@/lib/planWorkouts";

export type { PlanScheduleRevisionRecord } from "@/lib/planScheduleHistory";

export interface PlanWorkoutLike {
    id: string;
    name: string;
    dayNumber: number;
    dayOfWeek?: number | null;
}

export interface PlanWeekLike {
    weekNumber: number;
    workouts: PlanWorkoutLike[];
}

export interface ActiveUserPlanLike {
    startedAt: Date | string;
    plan: {
        weeks: PlanWeekLike[];
    };
    scheduleRevisions?: PlanScheduleRevisionRecord[];
}

export type PlanScheduleMode = "repeat" | "linear";

/** Single-week plans repeat forever; multi-week plans run once in order. */
export function getPlanScheduleMode(weekCount: number): PlanScheduleMode {
    return weekCount <= 1 ? "repeat" : "linear";
}

export function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Whole days since plan start (local calendar days). */
export function getPlanDayOffset(startedAt: Date | string, date: Date): number {
    const started = new Date(startedAt);
    started.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return Math.floor((targetDate.getTime() - started.getTime()) / 86400000);
}

/**
 * Map day offset to program week index.
 * - 1-week plans: always week 0 (repeats).
 * - Multi-week plans: linear index, null after the program ends.
 */
export function resolvePlanWeekIndex(weekCount: number, diffDays: number): number | null {
    if (weekCount <= 0 || diffDays < 0) return null;
    const weekIndex = Math.floor(diffDays / 7);
    if (weekCount === 1) return 0;
    if (weekIndex >= weekCount) return null;
    return weekIndex;
}

/** 1-based program week label (e.g. week 2 of 4), or null when outside the program. */
export function getPlanProgramWeekNumber(weekCount: number, diffDays: number): number | null {
    const index = resolvePlanWeekIndex(weekCount, diffDays);
    return index === null ? null : index + 1;
}

/** Last calendar date included in a finite multi-week program, or null when repeating. */
export function getPlanEndDateKey(startedAt: Date | string, weekCount: number): string | null {
    if (weekCount <= 1) return null;
    const startKey = toDateKey(new Date(startedAt));
    return addDaysToDateKey(startKey, weekCount * 7 - 1);
}

export function isDateAfterPlanEnd(
    startedAt: Date | string,
    weekCount: number,
    dateKey: string
): boolean {
    const endKey = getPlanEndDateKey(startedAt, weekCount);
    return endKey !== null && dateKey > endKey;
}

function findWorkoutOnWeek(week: PlanWeekLike, targetDate: Date): PlanWorkoutLike | null {
    const jsDow = targetDate.getDay();
    const dow0Mon = jsDow === 0 ? 6 : jsDow - 1;
    const fallbackDayNumber = dow0Mon + 1;
    const usesOneIndexedWeekdays = week.workouts.length >= 5
        && week.workouts.every((w) => w.dayOfWeek !== null && w.dayOfWeek !== undefined && w.dayOfWeek === w.dayNumber);
    const targetDayOfWeek = usesOneIndexedWeekdays
        ? (dow0Mon === 6 ? 0 : dow0Mon + 1)
        : dow0Mon;

    return week.workouts.find((w) => w.dayOfWeek === targetDayOfWeek)
        || week.workouts.find((w) => (w.dayOfWeek === null || w.dayOfWeek === undefined) && w.dayNumber === fallbackDayNumber)
        || null;
}

/** Resolve the scheduled workout for a calendar date from an active user plan. */
export function getPlannedWorkoutForDate(
    activeUserPlan: ActiveUserPlanLike | null | undefined,
    date: Date,
    options?: { today?: Date }
): PlanWorkoutLike | null {
    if (!activeUserPlan?.plan?.weeks?.length) return null;

    const today = options?.today
        ?? parseLogDate(getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey);
    const weeks = resolveScheduleWeeksForDate(
        activeUserPlan.plan.weeks,
        activeUserPlan.scheduleRevisions ?? [],
        date,
        today
    );
    if (weeks.length === 0) return null;

    const diffDays = getPlanDayOffset(activeUserPlan.startedAt, date);
    const weekIndex = resolvePlanWeekIndex(weeks.length, diffDays);
    if (weekIndex === null) return null;

    const week = weeks[weekIndex];
    if (!week) return null;

    return findWorkoutOnWeek(week, date);
}

export { activeWorkoutWhere };
