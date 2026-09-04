/**
 * All-time exercise records for PR correctness.
 *
 * UI history can stay paginated. Record boards used to judge NEW BEST / Weight PR /
 * exact-rep PR must fold every legitimate completed working set, not the last N
 * sessions.
 */

import { prisma } from "@/lib/prisma";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import {
    applySetToRecords,
    cloneExerciseRecords,
    EMPTY_EXERCISE_RECORDS,
    type ExerciseRecords,
} from "@/lib/exercisePrs";
import { calculateOneRM } from "@/lib/oneRepMax";
import {
    applySetToMetricRecords,
    cloneMetricRecords,
    EMPTY_METRIC_RECORDS,
    type MetricExerciseRecords,
} from "@/lib/exerciseTracking/prs";
import { resolveTrackingSchema } from "@/lib/exerciseTracking/resolve";

export interface RecordSetRow {
    logId: string;
    loggedAt: string;
    exerciseName: string;
    weightKg: number | null;
    reps: number | null;
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
}

export async function loadCompletedRecordSets(
    userId: string,
    options?: { excludeLogId?: string }
): Promise<RecordSetRow[]> {
    const sets = await prisma.logSet.findMany({
        where: {
            isWarmup: false,
            isCompleted: true,
            workoutLog: {
                userId,
                status: "COMPLETED",
                ...(options?.excludeLogId ? { id: { not: options.excludeLogId } } : {}),
            },
        },
        select: {
            weightKg: true,
            reps: true,
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
            exerciseName: true,
            exercise: { select: { name: true } },
            workoutLogId: true,
            workoutLog: { select: { loggedAt: true } },
        },
        orderBy: [{ workoutLog: { loggedAt: "asc" } }, { setNumber: "asc" }],
    });

    return sets.map((set) => ({
        logId: set.workoutLogId,
        loggedAt: set.workoutLog.loggedAt.toISOString(),
        exerciseName: canonicalExerciseName(resolveLogSetExerciseName(set)),
        weightKg: set.weightKg,
        reps: set.reps,
        durationSec: set.durationSec,
        distanceMeters: set.distanceMeters,
        heightCm: set.heightCm,
        resistance: set.resistance,
        inclinePct: set.inclinePct,
        calories: set.calories,
        heartRate: set.heartRate,
        speedKph: set.speedKph,
        isWarmup: set.isWarmup,
        isCompleted: set.isCompleted,
    }));
}

export async function loadAllTimeExerciseRecords(
    userId: string,
    options?: { excludeLogId?: string; exerciseNames?: string[] }
): Promise<Record<string, ExerciseRecords>> {
    const rows = await loadCompletedRecordSets(userId, options);
    const wanted = options?.exerciseNames?.length
        ? new Set(options.exerciseNames.map((name) => exerciseIdentityKey(canonicalExerciseName(name))).filter(Boolean))
        : null;

    const boards = new Map<string, ExerciseRecords>();
    for (const set of rows) {
        const key = exerciseIdentityKey(set.exerciseName);
        if (!key) continue;
        if (wanted && !wanted.has(key)) continue;
        if (!boards.has(key)) {
            boards.set(key, cloneExerciseRecords(EMPTY_EXERCISE_RECORDS));
        }
        applySetToRecords(boards.get(key)!, set);
    }

    return Object.fromEntries(boards);
}

export async function loadAllTimeMetricRecordBoards(
    userId: string,
    options?: { excludeLogId?: string }
): Promise<Map<string, MetricExerciseRecords>> {
    const rows = await loadCompletedRecordSets(userId, options);
    const boards = new Map<string, MetricExerciseRecords>();
    const schemaByKey = new Map<string, Awaited<ReturnType<typeof resolveTrackingSchema>>>();
    const uniqueNames = [...new Set(rows.map((set) => set.exerciseName.trim()).filter(Boolean))];
    await Promise.all(
        uniqueNames.map(async (name) => {
            const key = exerciseIdentityKey(name);
            if (!key || schemaByKey.has(key)) return;
            schemaByKey.set(key, await resolveTrackingSchema(name));
        })
    );

    for (const set of rows) {
        const name = set.exerciseName.trim();
        if (!name) continue;
        const key = exerciseIdentityKey(name);
        if (!key) continue;
        if (!schemaByKey.has(key)) {
            schemaByKey.set(key, await resolveTrackingSchema(name));
        }
        if (!boards.has(key)) {
            boards.set(key, cloneMetricRecords(EMPTY_METRIC_RECORDS));
        }

        const schema = schemaByKey.get(key)!;
        const oneRm =
            (set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0
                ? calculateOneRM(set.weightKg!, set.reps!)
                : null;
        applySetToMetricRecords(boards.get(key)!, set, schema, oneRm);
    }

    return boards;
}
