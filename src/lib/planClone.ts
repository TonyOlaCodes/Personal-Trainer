import { prisma } from "@/lib/prisma";
import type { PlanType } from "@prisma/client";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { resolvePlanOriginalCreatorId } from "@/lib/planCreator";
import { generateUniquePlanShareCode } from "@/lib/planShareCode";

export type ClonePlanOptions = {
    nameSuffix?: string;
    name?: string;
    type?: PlanType;
};

export async function clonePlanForUser(
    sourcePlanId: string,
    userId: string,
    optionsOrSuffix: ClonePlanOptions | string = " (Copied)"
) {
    const options: ClonePlanOptions = typeof optionsOrSuffix === "string"
        ? { nameSuffix: optionsOrSuffix }
        : optionsOrSuffix;

    const originalPlan = await prisma.plan.findUnique({
        where: { id: sourcePlanId },
        select: {
            name: true,
            description: true,
            creatorId: true,
            originalCreatorId: true,
            weeks: {
                orderBy: { weekNumber: "asc" },
                include: {
                    workouts: {
                        where: activeWorkoutWhere(),
                        orderBy: { dayNumber: "asc" },
                        include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
                    },
                },
            },
        },
    });

    if (!originalPlan) return null;

    const shareCode = await generateUniquePlanShareCode();
    const originalCreatorId = resolvePlanOriginalCreatorId(originalPlan);

    const clonedName = options.name ?? `${originalPlan.name}${options.nameSuffix ?? " (Copied)"}`;

    const clonedPlan = await prisma.plan.create({
        data: {
            name: clonedName,
            description: originalPlan.description,
            type: options.type ?? "USER_CREATED",
            creatorId: userId,
            originalCreatorId,
            isPublic: false,
            shareCode,
            weeks: {
                create: originalPlan.weeks.map((week) => ({
                    weekNumber: week.weekNumber,
                    name: week.name,
                    workouts: {
                        create: week.workouts.map((workout) => ({
                            dayNumber: workout.dayNumber,
                            dayOfWeek: workout.dayOfWeek,
                            name: workout.name,
                            notes: workout.notes,
                            exercises: {
                                create: workout.exercises.map((exercise) => ({
                                    name: exercise.name,
                                    sets: exercise.sets,
                                    reps: exercise.reps,
                                    weightTargetKg: exercise.weightTargetKg,
                                    restSeconds: exercise.restSeconds,
                                    notes: exercise.notes,
                                    order: exercise.order,
                                    muscleGroup: exercise.muscleGroup,
                                })),
                            },
                        })),
                    },
                })),
            },
        },
    });

    return clonedPlan;
}
