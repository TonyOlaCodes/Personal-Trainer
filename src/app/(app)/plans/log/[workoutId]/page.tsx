import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";
import { getExerciseMediaByNames } from "@/lib/exerciseMedia";

export const metadata = { title: "Logging session" };

export default async function WorkoutLogPage({
    params,
    searchParams,
}: {
    params: Promise<{ workoutId: string }>;
    searchParams: Promise<{ date?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { workoutId } = await params;
    const { date } = await searchParams;

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }
    });
    if (!user) redirect("/sign-in");

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
    });

    if (!workout) notFound();

    const lastLog = await prisma.workoutLog.findFirst({
        where: {
            userId: user.id,
            workoutId: workout.id,
            status: "COMPLETED",
        },
        orderBy: { loggedAt: "desc" },
        include: {
            sets: {
                orderBy: { setNumber: "asc" },
                include: {
                    exercise: { select: { name: true } }
                }
            }
        }
    });

    const lastWorkoutLogSets = lastLog ? lastLog.sets.map((s) => ({
        exerciseName: s.exercise?.name || "",
        setNumber: s.setNumber,
        weightKg: s.weightKg,
    })) : [];

    const mediaByName = await getExerciseMediaByNames(workout.exercises.map((exercise) => exercise.name));
    const exerciseMedia = Object.fromEntries(mediaByName.entries());

    return (
        <div className="bg-surface min-h-screen">
            <WorkoutLogClient
                workout={{
                    id: workout.id,
                    name: workout.name,
                    exercises: workout.exercises.map((ex) => ({
                        id: ex.id,
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        weightTargetKg: ex.weightTargetKg,
                        notes: ex.notes,
                        order: ex.order,
                    })),
                }}
                exerciseMedia={exerciseMedia}
                logDate={date}
                lastWorkoutLogSets={lastWorkoutLogSets}
            />
        </div>
    );
}
