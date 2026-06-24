import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";
import { getExerciseMediaByNames } from "@/lib/exerciseMedia";
import { getLocalDayBounds, parseLogDate, toDateKey } from "@/lib/utils";
import { withResolvedLogSetMedia } from "@/lib/uploadUrls";

export const metadata = { title: "Logging session" };

const activeLogInclude = {
    sets: {
        orderBy: { setNumber: "asc" as const },
        include: {
            exercise: {
                select: {
                    id: true,
                    name: true,
                    sets: true,
                    reps: true,
                    weightTargetKg: true,
                    notes: true,
                    order: true,
                    muscleGroup: true,
                },
            },
        },
    },
};

export default async function WorkoutLogPage({
    params,
    searchParams,
}: {
    params: Promise<{ workoutId: string }>;
    searchParams: Promise<{ date?: string }>;
}) {
    await ensureDbSchema();
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { workoutId } = await params;
    const { date } = await searchParams;

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
    });
    if (!user) redirect("/sign-in");

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
    });

    if (!workout) notFound();

    const dateKey = date ? toDateKey(parseLogDate(date)) : toDateKey(new Date());
    const { start: dayStart, end: dayEnd } = getLocalDayBounds(parseLogDate(dateKey));

    let activeLog = await prisma.workoutLog.findFirst({
        where: {
            userId: user.id,
            workoutId: workout.id,
            status: "IN_PROGRESS",
            loggedAt: { gte: dayStart, lte: dayEnd },
        },
        include: activeLogInclude,
    });

    const recentCompletedSets = await prisma.logSet.findMany({
        where: {
            isCompleted: true,
            workoutLog: {
                userId: user.id,
                status: "COMPLETED",
            },
        },
        include: {
            exercise: { select: { name: true } },
            workoutLog: { select: { loggedAt: true } },
        },
        orderBy: { workoutLog: { loggedAt: "desc" } },
        take: 1000,
    });

    const seenSetKeys = new Set<string>();
    const lastWorkoutLogSets: Array<{
        exerciseName: string;
        setNumber: number;
        weightKg: number | null;
        reps: number | null;
        rpe: number | null;
    }> = [];

    for (const set of recentCompletedSets) {
        const exerciseName = set.exercise?.name;
        if (!exerciseName) continue;
        const key = `${exerciseName.toLowerCase()}::${set.setNumber}`;
        if (seenSetKeys.has(key)) continue;
        seenSetKeys.add(key);
        lastWorkoutLogSets.push({
            exerciseName,
            setNumber: set.setNumber,
            weightKg: set.weightKg,
            reps: set.reps,
            rpe: set.rpe,
        });
    }

    const mediaByName = await getExerciseMediaByNames(workout.exercises.map((exercise) => exercise.name));
    const exerciseMedia = Object.fromEntries(mediaByName.entries());

    const initialActiveLog = activeLog
        ? {
              id: activeLog.id,
              loggedAt: activeLog.loggedAt.toISOString(),
              duration: activeLog.duration,
              sets: activeLog.sets.map((set) => withResolvedLogSetMedia({
                  exerciseId: set.exerciseId,
                  setNumber: set.setNumber,
                  reps: set.reps,
                  weightKg: set.weightKg,
                  rpe: set.rpe,
                  isCompleted: set.isCompleted,
                  isWarmup: set.isWarmup,
                  videoUrl: set.videoUrl,
                  exercise: set.exercise,
              })),
          }
        : null;

    return (
        <div className="bg-surface min-h-screen">
            <Suspense fallback={<div className="min-h-screen bg-surface" />}>
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
                        muscleGroup: ex.muscleGroup,
                    })),
                }}
                exerciseMedia={exerciseMedia}
                logDate={date}
                lastWorkoutLogSets={lastWorkoutLogSets}
                initialActiveLog={initialActiveLog}
                />
            </Suspense>
        </div>
    );
}
