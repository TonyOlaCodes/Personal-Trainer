import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** User-facing errors — keep messages actionable. */
export const DataSafetyError = {
    planHasHistory:
        "This plan has logged training sessions and cannot be permanently deleted. Deactivate it or remove it from your library instead — your session history will be kept.",
    exerciseHasHistory:
        "This exercise has logged sets and was hidden from the plan instead of deleted, so training history is preserved.",
    workoutHasHistory:
        "This workout has logged sessions and cannot be removed while history exists.",
} as const;

export type DbClient = Prisma.TransactionClient | typeof prisma;

function client(db?: DbClient): DbClient {
    return db ?? prisma;
}

export async function countWorkoutLogsForPlan(planId: string, db?: DbClient): Promise<number> {
    return client(db).workoutLog.count({
        where: { workout: { week: { planId } } },
    });
}

export async function countWorkoutLogsForWorkout(workoutId: string, db?: DbClient): Promise<number> {
    return client(db).workoutLog.count({ where: { workoutId } });
}

export async function countLogSetsForExercise(exerciseId: string, db?: DbClient): Promise<number> {
    return client(db).logSet.count({ where: { exerciseId } });
}

/** Hide a plan exercise from editors without breaking historical log_set references. */
export async function softHideExercise(exerciseId: string, db?: DbClient) {
    return client(db).exercise.update({
        where: { id: exerciseId },
        data: { isCustom: true },
    });
}
