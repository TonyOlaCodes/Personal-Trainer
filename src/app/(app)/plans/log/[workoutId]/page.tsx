import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";
import { getExerciseMediaByNames } from "@/lib/exerciseMedia";
import { getLocalDayBounds, parseLogDate, toDateKey } from "@/lib/utils";

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
    searchParams: Promise<{ date?: string; start?: string }>;
}) {
    await ensureDbSchema();
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { workoutId } = await params;
    const { date, start } = await searchParams;

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

    if (!activeLog && start === "1") {
        activeLog = await prisma.workoutLog.create({
            data: {
                userId: user.id,
                workoutId: workout.id,
                status: "IN_PROGRESS",
                loggedAt: parseLogDate(dateKey),
                sets: {
                    create: workout.exercises.flatMap((ex) =>
                        Array.from({ length: ex.sets }, (_, i) => ({
                            exerciseId: ex.id,
                            setNumber: i + 1,
                            reps: Number.parseInt(ex.reps, 10) || 10,
                            isCompleted: false,
                            isWarmup: false,
                        }))
                    ),
                },
            },
            include: activeLogInclude,
        });
    }

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
                    exercise: { select: { name: true } },
                },
            },
        },
    });

    const lastWorkoutLogSets = lastLog
        ? lastLog.sets.map((s) => ({
              exerciseName: s.exercise?.name || "",
              setNumber: s.setNumber,
              weightKg: s.weightKg,
          }))
        : [];

    const mediaByName = await getExerciseMediaByNames(workout.exercises.map((exercise) => exercise.name));
    const exerciseMedia = Object.fromEntries(mediaByName.entries());

    const initialActiveLog = activeLog
        ? {
              id: activeLog.id,
              loggedAt: activeLog.loggedAt.toISOString(),
              duration: activeLog.duration,
              sets: activeLog.sets.map((set) => ({
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
        </div>
    );
}
