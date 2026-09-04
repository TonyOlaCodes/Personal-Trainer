/**
 * Loads completed training history in the shape the shared PR and previous-session
 * helpers expect, so every surface (workout screen, session review, coach
 * progression) reads the same facts from the same query.
 */

import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import type { HistoricalSessionInput } from "@/lib/exercisePrs";

export interface LoadedHistorySet {
    id: string;
    exerciseId: string;
    exerciseName: string;
    exerciseOrder: number | null;
    setNumber: number;
    reps: number | null;
    weightKg: number | null;
    rpe: number | null;
    durationSec: number | null;
    distanceMeters: number | null;
    heightCm: number | null;
    resistance: number | null;
    inclinePct: number | null;
    calories: number | null;
    heartRate: number | null;
    speedKph: number | null;
    isWarmup: boolean;
    isCompleted: boolean;
    isPR: boolean;
}

export interface LoadedHistorySession extends HistoricalSessionInput {
    logId: string;
    workoutId: string;
    workoutName: string;
    loggedAt: string;
    durationMinutes: number | null;
    feeling: number | null;
    notes: string | null;
    sets: LoadedHistorySet[];
}

/** UI/previous-session window only. All-time PRs use `loadAllTimeExerciseRecords`. */
const DEFAULT_SESSION_LIMIT = 400;

/**
 * Completed sessions newest-first, with exercise names canonicalised so plural and
 * spelling variants line up on one continuous history.
 */
export async function loadWorkoutHistorySessions(
    userId: string,
    options?: { limit?: number; excludeLogId?: string }
): Promise<LoadedHistorySession[]> {
    const logs = await prisma.workoutLog.findMany({
        where: {
            userId,
            status: "COMPLETED",
            ...(options?.excludeLogId ? { id: { not: options.excludeLogId } } : {}),
        },
        select: {
            id: true,
            workoutId: true,
            loggedAt: true,
            duration: true,
            feeling: true,
            notes: true,
            workout: { select: { name: true } },
            sets: {
                orderBy: logSetDisplayOrderBy,
                select: {
                    id: true,
                    exerciseId: true,
                    exerciseName: true,
                    exerciseOrder: true,
                    setNumber: true,
                    reps: true,
                    weightKg: true,
                    rpe: true,
                    durationSec: true,
                    distanceMeters: true,
                    heightCm: true,
                    resistance: true,
                    inclinePct: true,
                    calories: true,
                    heartRate: true,
                    speedKph: true,
                    isWarmup: true,
                    isCompleted: true,
                    isPR: true,
                    exercise: { select: { name: true } },
                },
            },
        },
        orderBy: { loggedAt: "desc" },
        take: options?.limit ?? DEFAULT_SESSION_LIMIT,
    });

    return logs.map((log) => ({
        logId: log.id,
        workoutId: log.workoutId,
        workoutName: log.workout.name,
        dateKey: getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey,
        loggedAt: log.loggedAt.toISOString(),
        durationMinutes: log.duration ?? null,
        feeling: log.feeling ?? null,
        notes: log.notes ?? null,
        sets: log.sets.map((set) => ({
            id: set.id,
            exerciseId: set.exerciseId,
            exerciseName: canonicalExerciseName(resolveLogSetExerciseName(set)),
            exerciseOrder: set.exerciseOrder ?? null,
            setNumber: set.setNumber,
            reps: set.reps ?? null,
            weightKg: set.weightKg ?? null,
            rpe: set.rpe ?? null,
            durationSec: set.durationSec ?? null,
            distanceMeters: set.distanceMeters ?? null,
            heightCm: set.heightCm ?? null,
            resistance: set.resistance ?? null,
            inclinePct: set.inclinePct ?? null,
            calories: set.calories ?? null,
            heartRate: set.heartRate ?? null,
            speedKph: set.speedKph ?? null,
            isWarmup: set.isWarmup,
            isCompleted: set.isCompleted,
            isPR: set.isPR,
        })),
    }));
}

/** Total kilograms lifted in a session, warmups excluded. */
export function sessionVolumeKg(session: Pick<LoadedHistorySession, "sets">): number {
    return session.sets.reduce((total, set) => {
        if (set.isWarmup || !set.isCompleted) return total;
        const weight = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        if (weight <= 0 || reps <= 0) return total;
        return total + weight * reps;
    }, 0);
}

/** Sets actually performed in a session, warmups excluded. */
export function sessionWorkingSetCount(session: Pick<LoadedHistorySession, "sets">): number {
    return session.sets.filter((set) => !set.isWarmup && set.isCompleted).length;
}
