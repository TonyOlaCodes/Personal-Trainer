import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { activeWorkoutWhere } from "@/lib/planWorkouts";

export async function clonePlanForUser(sourcePlanId: string, userId: string, nameSuffix = " (Copied)") {
    const originalPlan = await prisma.plan.findUnique({
        where: { id: sourcePlanId },
        include: {
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

    const shareCode = randomBytes(4).toString("hex").toUpperCase();

    const clonedPlan = await prisma.plan.create({
        data: {
            name: `${originalPlan.name}${nameSuffix}`,
            description: originalPlan.description,
            type: "USER_CREATED",
            creatorId: userId,
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
