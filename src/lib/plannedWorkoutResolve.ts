import {
    getPlanDayOffset,
    getPlannedWorkoutForDate,
    resolvePlanWeekIndex,
    type ActiveUserPlanLike,
} from "@/lib/planSchedule";
import {
    resolveScheduleWeeksForDate,
    type PlanScheduleRevisionRecord,
    type ScheduleWeekSnapshot,
} from "@/lib/planScheduleHistory";
import { toDateKey } from "@/lib/utils";

export interface PlannedWorkoutExercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    order: number;
}

export interface ResolvedPlannedWorkout {
    id: string;
    name: string;
    dayNumber: number;
    dayOfWeek: number | null;
    exercises: PlannedWorkoutExercise[];
}

type WeekWithExercises = ScheduleWeekSnapshot;

/** Resolve scheduled workout + plan-order exercises for a calendar date (respects schedule revisions). */
export function resolvePlannedWorkoutWithExercisesForDate(input: {
    startedAt: string | Date;
    weeks: WeekWithExercises[];
    scheduleRevisions?: PlanScheduleRevisionRecord[];
    date: Date;
    today?: Date;
    dateKey?: string;
}): ResolvedPlannedWorkout | null {
    const today = input.today ?? input.date;
    const dateKey = input.dateKey ?? toDateKey(input.date);
    const activeUserPlan: ActiveUserPlanLike = {
        startedAt: input.startedAt,
        plan: { weeks: input.weeks },
        scheduleRevisions: input.scheduleRevisions ?? [],
    };

    const planned = getPlannedWorkoutForDate(activeUserPlan, input.date, { today, dateKey });
    if (!planned) return null;

    const weeks = resolveScheduleWeeksForDate(
        input.weeks,
        input.scheduleRevisions ?? [],
        input.date,
        today,
        dateKey
    );
    const diffDays = getPlanDayOffset(input.startedAt, input.date, dateKey);
    const weekIndex = resolvePlanWeekIndex(weeks.length, diffDays);
    if (weekIndex === null) return null;

    const week = weeks[weekIndex];
    const workout = week?.workouts.find((row) => row.id === planned.id);

    const exercises = (workout?.exercises ?? []).map((exercise, index) => ({
        id: exercise.id ?? `${planned.id}-ex-${index}`,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        order: index,
    }));

    return {
        id: planned.id,
        name: planned.name,
        dayNumber: workout?.dayNumber ?? planned.dayNumber,
        dayOfWeek: workout?.dayOfWeek ?? planned.dayOfWeek ?? null,
        exercises,
    };
}

export function sortPlannedExercises<T extends { order?: number | null }>(exercises: T[]): T[] {
    return exercises
        .slice()
        .map((exercise, index) => ({ exercise, index }))
        .sort((a, b) => {
            const orderA = a.exercise.order ?? a.index;
            const orderB = b.exercise.order ?? b.index;
            if (orderA !== orderB) return orderA - orderB;
            return a.index - b.index;
        })
        .map(({ exercise }) => exercise);
}
