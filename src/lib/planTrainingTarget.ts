import { getPlanDayOffset, resolvePlanWeekIndex } from "./planSchedule";

type PlanWorkoutLike = {
    name: string;
    exercises?: { id?: string }[] | null;
    /**
     * When true, this slot is required training even if exercises are empty
     * (used for historical/log reconstructions that omit set lists).
     */
    isScheduledTraining?: boolean;
};

/**
 * Rest Day = an explicit rest slot, not merely "no exercises listed".
 *
 * Empty exercise arrays alone are NOT rest — calendar reconstructions of past
 * missed/completed sessions often omit exercises while keeping the workout name.
 */
export function isRestPlanWorkout(workout: PlanWorkoutLike): boolean {
    if (workout.isScheduledTraining) return false;

    const name = workout.name.trim();
    if (!name) {
        // Unnamed empty slots are treated as non-training.
        return (workout.exercises?.length ?? 0) === 0;
    }
    if (
        /^rest$/i.test(name)
        || /\brest\s*day\b/i.test(name)
        || /^rest\b/i.test(name)
    ) {
        return true;
    }
    return false;
}

/** True when this day has a required training workout (not Rest). */
export function isScheduledTrainingWorkout(
    workout: PlanWorkoutLike | null | undefined
): boolean {
    if (!workout) return false;
    return !isRestPlanWorkout(workout);
}

/** Count real training sessions in a plan week (excludes rest / empty days). */
export function countPlannedTrainingSessions(workouts: PlanWorkoutLike[]): number {
    const training = workouts.filter((workout) => !isRestPlanWorkout(workout));
    if (training.length > 0) return training.length;
    return workouts.length;
}

type ActivePlanLike = {
    startedAt: Date | string;
    plan: {
        weeks: Array<{
            workouts: PlanWorkoutLike[];
        }>;
    };
};

export function getCurrentPlanWeekIndex(activePlanLike: ActivePlanLike, now = new Date()): number {
    const weeks = activePlanLike.plan.weeks;
    if (weeks.length === 0) return 0;

    const diffDays = getPlanDayOffset(activePlanLike.startedAt, now);
    const index = resolvePlanWeekIndex(weeks.length, diffDays);
    if (index === null) return weeks.length - 1;
    return index;
}

export function getWorkoutsTargetFromUserPlan(
    trainingDaysPerWeek: number | null | undefined,
    activeUserPlan: ActivePlanLike | null | undefined,
    now = new Date()
): number {
    let target = trainingDaysPerWeek ?? 4;
    if (!activeUserPlan) return target;

    const week = activeUserPlan.plan.weeks[getCurrentPlanWeekIndex(activeUserPlan, now)];
    if (!week) return target;

    const planned = countPlannedTrainingSessions(week.workouts);
    if (planned > 0) target = planned;
    return target;
}
