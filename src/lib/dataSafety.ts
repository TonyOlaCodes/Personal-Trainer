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

/** Delete a plan when it has no logged sessions. */
export async function deletePlanIfNoHistory(planId: string, db?: DbClient): Promise<"deleted" | "blocked"> {
    const logCount = await countWorkoutLogsForPlan(planId, db);
    if (logCount > 0) return "blocked";
    await client(db).plan.delete({ where: { id: planId } });
    return "deleted";
}

/** Remove all same-name plans for a creator (admin cleanup for duplicate rows). */
export async function deleteDuplicatePlansByName(
    plan: { id: string; name: string; creatorId: string | null },
    db?: DbClient
) {
    const dbClient = client(db);
    const siblings = plan.creatorId
        ? await dbClient.plan.findMany({
            where: { creatorId: plan.creatorId, name: plan.name },
            select: { id: true },
        })
        : [{ id: plan.id }];

    const deletedIds: string[] = [];
    const blockedIds: string[] = [];

    for (const sibling of siblings) {
        const result = await deletePlanIfNoHistory(sibling.id, dbClient);
        if (result === "deleted") deletedIds.push(sibling.id);
        else blockedIds.push(sibling.id);
    }

    return { deletedIds, blockedIds };
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
