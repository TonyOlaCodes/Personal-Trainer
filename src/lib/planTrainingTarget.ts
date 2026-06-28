import { getPlanDayOffset, resolvePlanWeekIndex } from "./planSchedule";

type PlanWorkoutLike = {
    name: string;
    exercises?: { id?: string }[] | null;
};

export function isRestPlanWorkout(workout: PlanWorkoutLike): boolean {
    const name = workout.name.trim();
    if (/^rest$/i.test(name) || /rest day/i.test(name)) return true;
    return (workout.exercises?.length ?? 0) === 0;
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

export function getCurrentPlanWeekIndex(activeUserPlan: ActivePlanLike, now = new Date()): number {
    const weeks = activeUserPlan.plan.weeks;
    if (weeks.length === 0) return 0;

    const diffDays = getPlanDayOffset(activeUserPlan.startedAt, now);
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
