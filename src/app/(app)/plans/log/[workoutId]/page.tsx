import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";
import { getExerciseMediaByNames } from "@/lib/exerciseMedia";
import { getLocalDayBounds, parseLogDate, toDateKey } from "@/lib/utils";
import { withResolvedLogSetMedia } from "@/lib/uploadUrls";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { canAccessClient } from "@/lib/apiAuth";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { defaultHomeForRole, isCoachRole } from "@/lib/roles";

export const metadata = { title: "Logging session" };
const NEW_ACCOUNT_WORKOUT_HINT_DAYS = 30;
const NEW_ACCOUNT_WORKOUT_HINT_MS = NEW_ACCOUNT_WORKOUT_HINT_DAYS * 24 * 60 * 60 * 1000;

const activeLogInclude = {
    sets: {
        orderBy: logSetDisplayOrderBy,
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
    searchParams: Promise<{ date?: string; clientId?: string }>;
}) {
    await ensureDbSchema();
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { workoutId } = await params;
    const { date, clientId } = await searchParams;

    const actor = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true, createdAt: true },
    });
    if (!actor) redirect("/sign-in");
    const showWorkoutInputHint = Date.now() - actor.createdAt.getTime() < NEW_ACCOUNT_WORKOUT_HINT_MS;

    let subjectUserId = actor.id;
    let clientName: string | undefined;

    if (clientId && clientId !== actor.id) {
        if (!(await canAccessClient(actor, clientId))) {
            redirect(defaultHomeForRole(actor.role));
        }
        const client = await prisma.user.findUnique({
            where: { id: clientId },
            select: { name: true, isDeleted: true, isDeactivated: true, email: true },
        });
        if (!client || isInactiveAccount(client)) {
            redirect(defaultHomeForRole(actor.role));
        }
        subjectUserId = clientId;
        clientName = client.name ?? undefined;
    } else if (isCoachRole(actor.role)) {
        redirect(defaultHomeForRole(actor.role));
    }

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
    });

    if (!workout) notFound();

    const dateKey = date ? toDateKey(parseLogDate(date)) : toDateKey(new Date());
    const { start: dayStart, end: dayEnd } = getLocalDayBounds(parseLogDate(dateKey));

    const activeLog = await prisma.workoutLog.findFirst({
        where: {
            userId: subjectUserId,
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
                userId: subjectUserId,
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
        exerciseId: string;
        exerciseName: string;
        setNumber: number;
        weightKg: number | null;
        reps: number | null;
        rpe: number | null;
    }> = [];

    for (const set of recentCompletedSets) {
        const exerciseName = resolveLogSetExerciseName(set);
        if (!exerciseName || exerciseName === "Unknown") continue;
        const key = `${set.exerciseId}::${set.setNumber}`;
        if (seenSetKeys.has(key)) continue;
        seenSetKeys.add(key);
        lastWorkoutLogSets.push({
            exerciseId: set.exerciseId,
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
              updatedAt: activeLog.updatedAt.toISOString(),
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
                clientId={clientId && clientId !== actor.id ? clientId : undefined}
                clientName={clientName}
                lastWorkoutLogSets={lastWorkoutLogSets}
                initialActiveLog={initialActiveLog}
                showWorkoutInputHint={showWorkoutInputHint}
                />
            </Suspense>
        </div>
    );
}
