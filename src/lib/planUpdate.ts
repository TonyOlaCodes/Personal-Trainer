import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface PlanExercisePayload {
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
    order?: number | null;
    muscleGroup?: string | null;
}

export interface PlanWorkoutPayload {
    dayNumber: number;
    dayOfWeek?: number | null;
    name: string;
    notes?: string | null;
    exercises: PlanExercisePayload[];
}

export interface PlanWeekPayload {
    weekNumber: number;
    name?: string | null;
    workouts: PlanWorkoutPayload[];
}

export interface PlanPatchPayload {
    name: string;
    description?: string | null;
    weeks: PlanWeekPayload[];
}

type Tx = Prisma.TransactionClient;

const planInclude = {
    weeks: {
        orderBy: { weekNumber: "asc" as const },
        include: {
            workouts: {
                orderBy: { dayNumber: "asc" as const },
                include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" as const } } },
            },
        },
    },
};

async function syncExercises(
    tx: Tx,
    workoutId: string,
    payloadExercises: PlanExercisePayload[],
    existingExercises: { id: string; _count?: { logSets: number } }[]
) {
    const existing = existingExercises.length
        ? existingExercises
        : await tx.exercise.findMany({
            where: { workoutId, isCustom: false },
            orderBy: { order: "asc" },
            include: { _count: { select: { logSets: true } } },
        });

    for (let i = 0; i < payloadExercises.length; i++) {
        const ex = payloadExercises[i];
        const data = {
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weightTargetKg: ex.weightTargetKg ?? undefined,
            restSeconds: ex.restSeconds ?? undefined,
            notes: ex.notes ?? undefined,
            order: ex.order ?? i,
            muscleGroup: ex.muscleGroup ?? undefined,
            isCustom: false,
        };

        if (existing[i]) {
            await tx.exercise.update({ where: { id: existing[i].id }, data });
        } else {
            await tx.exercise.create({ data: { workoutId, ...data } });
        }
    }

    for (let i = payloadExercises.length; i < existing.length; i++) {
        const ex = existing[i];
        const logSetCount = ex._count?.logSets ?? (await tx.logSet.count({ where: { exerciseId: ex.id } }));
        if (logSetCount > 0) {
            await tx.exercise.update({ where: { id: ex.id }, data: { isCustom: true } });
        } else {
            await tx.exercise.delete({ where: { id: ex.id } });
        }
    }
}

async function syncWeekWorkouts(tx: Tx, weekId: string, workouts: PlanWorkoutPayload[]) {
    const existing = await tx.workout.findMany({
        where: { weekId },
        include: {
            logs: { select: { id: true }, take: 1 },
            exercises: {
                where: { isCustom: false },
                orderBy: { order: "asc" },
                include: { _count: { select: { logSets: true } } },
            },
        },
        orderBy: { dayNumber: "asc" },
    });

    const originalDayById = new Map(existing.map((w) => [w.id, w.dayNumber]));

    for (const workout of existing) {
        await tx.workout.update({
            where: { id: workout.id },
            data: { dayNumber: workout.dayNumber + 1000 },
        });
    }

    const matchedIds = new Set<string>();

    for (const wd of workouts) {
        let workout = existing.find((w) => {
            if (matchedIds.has(w.id)) return false;
            if (wd.dayOfWeek !== null && wd.dayOfWeek !== undefined && w.dayOfWeek === wd.dayOfWeek) return true;
            return originalDayById.get(w.id) === wd.dayNumber;
        });

        if (!workout) {
            workout = existing.find((w) => !matchedIds.has(w.id));
        }

        if (workout) {
            matchedIds.add(workout.id);
            await tx.workout.update({
                where: { id: workout.id },
                data: {
                    dayNumber: wd.dayNumber,
                    dayOfWeek: wd.dayOfWeek ?? null,
                    name: wd.name,
                    notes: wd.notes ?? null,
                },
            });
            await syncExercises(tx, workout.id, wd.exercises, workout.exercises);
        } else {
            const created = await tx.workout.create({
                data: {
                    weekId,
                    dayNumber: wd.dayNumber,
                    dayOfWeek: wd.dayOfWeek ?? null,
                    name: wd.name,
                    notes: wd.notes ?? null,
                },
            });
            await syncExercises(tx, created.id, wd.exercises, []);
        }
    }

    for (const workout of existing) {
        if (matchedIds.has(workout.id)) continue;
        if (workout.logs.length > 0) continue;
        await tx.workout.delete({ where: { id: workout.id } });
    }
}

/** Update plan structure in place so workout logs and session history are preserved. */
export async function updatePlanPreservingHistory(
    planId: string,
    name: string,
    description: string | null | undefined,
    weeks: PlanWeekPayload[]
) {
    return prisma.$transaction(async (tx) => {
        await tx.plan.update({
            where: { id: planId },
            data: { name, description },
        });

        const existingWeeks = await tx.week.findMany({
            where: { planId },
            include: {
                workouts: {
                    include: { logs: { select: { id: true }, take: 1 } },
                },
            },
        });

        const payloadWeekNumbers = new Set(weeks.map((w) => w.weekNumber));

        for (const week of existingWeeks) {
            if (payloadWeekNumbers.has(week.weekNumber)) continue;
            const hasLogs = week.workouts.some((w) => w.logs.length > 0);
            if (hasLogs) continue;
            await tx.week.delete({ where: { id: week.id } });
        }

        for (const weekPayload of weeks) {
            const week = await tx.week.upsert({
                where: { planId_weekNumber: { planId, weekNumber: weekPayload.weekNumber } },
                create: {
                    planId,
                    weekNumber: weekPayload.weekNumber,
                    name: weekPayload.name ?? null,
                },
                update: { name: weekPayload.name ?? null },
            });

            await syncWeekWorkouts(tx, week.id, weekPayload.workouts);
        }

        return tx.plan.findUniqueOrThrow({
            where: { id: planId },
            include: planInclude,
        });
    });
}
