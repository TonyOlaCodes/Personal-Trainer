import { activeWorkoutWhere } from "@/lib/planWorkouts";

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
}

/** Resolve the scheduled workout for a calendar date from an active user plan. */
export function getPlannedWorkoutForDate(
    activeUserPlan: ActiveUserPlanLike | null | undefined,
    date: Date
): PlanWorkoutLike | null {
    if (!activeUserPlan?.plan?.weeks?.length) return null;

    const weeks = activeUserPlan.plan.weeks;
    const startedAt = new Date(activeUserPlan.startedAt);
    startedAt.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((targetDate.getTime() - startedAt.getTime()) / 86400000);
    if (diffDays < 0) return null;

    let weekIndex = Math.floor(diffDays / 7);
    if (weekIndex >= weeks.length) weekIndex = weekIndex % weeks.length;

    const week = weeks[weekIndex] || weeks[0];
    if (!week) return null;

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

export { activeWorkoutWhere };
