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
import { loadWorkoutHistorySessions } from "@/lib/workoutHistory";
import {
    buildExerciseRecords,
    findPreviousSessionPerformance,
    type ExerciseRecords,
    type PreviousSessionPerformance,
} from "@/lib/exercisePrs";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { getLogExerciseNotes } from "@/lib/logExerciseNotes";

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

    /**
     * Previous-session data and all-time records come from one history read, keyed by
     * canonical exercise identity so "Pull Ups" and "Pull-Up" share a single history.
     *
     * `previousSessions` holds only the most recent session in which each exercise was
     * actually performed, which is what keeps a set 3 placeholder empty when last time
     * only two sets were done. Records exclude the session being logged so a PR badge
     * cannot compare a set against itself.
     */
    const history = await loadWorkoutHistorySessions(subjectUserId, { excludeLogId: activeLog?.id });

    const historyExerciseNames = [
        ...workout.exercises.map((exercise) => exercise.name),
        ...(activeLog?.sets ?? []).map((set) => resolveLogSetExerciseName(set)),
    ];

    const previousSessions: Record<string, PreviousSessionPerformance> = {};
    const exerciseRecords: Record<string, ExerciseRecords> = {};

    for (const rawName of historyExerciseNames) {
        const name = canonicalExerciseName(rawName);
        const key = exerciseIdentityKey(name);
        if (!key || previousSessions[key] || exerciseRecords[key]) continue;

        const previous = findPreviousSessionPerformance(history, name);
        if (previous) previousSessions[key] = previous;
        exerciseRecords[key] = buildExerciseRecords(history, name);
    }

    const initialExerciseNotes = activeLog ? await getLogExerciseNotes(activeLog.id) : {};

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
                previousSessions={previousSessions}
                exerciseRecords={exerciseRecords}
                initialExerciseNotes={initialExerciseNotes}
                initialActiveLog={initialActiveLog}
                showWorkoutInputHint={showWorkoutInputHint}
                />
            </Suspense>
        </div>
    );
}
