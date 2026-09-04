/**
 * Annotate completed-session sets with canonical PR badges for review UIs
 * (athlete log view, coach review). Recomputes against history so labels stay
 * correct after the PR definition change even if stored isPR/prLabel is stale.
 */

import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import {
    buildRecordsByExercise,
    evaluateSessionPrs,
    type HistoricalSessionInput,
    type SetPrResult,
} from "@/lib/exercisePrs";
import {
    cloneMetricRecords,
    EMPTY_METRIC_RECORDS,
    evaluateMetricAwarePr,
    applySetToMetricRecords,
    type MetricExerciseRecords,
    type MetricPrResult,
} from "@/lib/exerciseTracking/prs";
import type { ExerciseTrackingSchema } from "@/lib/exerciseTracking/types";
import { calculateOneRM } from "@/lib/oneRepMax";

export type AnnotatableSet = {
    id: string;
    exerciseName: string | null | undefined;
    weightKg?: number | null;
    reps?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
    rpe?: number | null;
    rir?: number | null;
    isWarmup?: boolean | null;
    isCompleted?: boolean | null;
};

/** Strength-only annotation (when schemas aren't available). */
export function annotateStrengthSessionPrs(
    sets: AnnotatableSet[],
    history: HistoricalSessionInput[],
    excludeLogId?: string
): Map<string, SetPrResult> {
    const recordsByExercise = buildRecordsByExercise(history, { excludeLogId });
    const evaluated = evaluateSessionPrs(sets, recordsByExercise);
    const out = new Map<string, SetPrResult>();
    for (const { set, pr } of evaluated) {
        if (set.id) out.set(set.id, pr);
    }
    return out;
}

/**
 * Metric-aware annotation. `schemaFor` resolves tracking schema per exercise name.
 */
export function annotateMetricSessionPrs(
    sets: AnnotatableSet[],
    history: HistoricalSessionInput[],
    schemaFor: (exerciseName: string) => ExerciseTrackingSchema,
    excludeLogId?: string
): Map<string, MetricPrResult> {
    const boards = new Map<string, ReturnType<typeof cloneMetricRecords>>();
    const schemas = new Map<string, ExerciseTrackingSchema>();

    const ensure = (name: string) => {
        const key = exerciseIdentityKey(name) || name.toLowerCase();
        if (!boards.has(key)) {
            boards.set(key, cloneMetricRecords(EMPTY_METRIC_RECORDS));
            schemas.set(key, schemaFor(name));
        }
        return { key, board: boards.get(key)!, schema: schemas.get(key)! };
    };

    for (const session of history) {
        if (excludeLogId && session.logId === excludeLogId) continue;
        for (const set of session.sets) {
            if (set.isWarmup || set.isCompleted === false) continue;
            const name = set.exerciseName?.trim();
            if (!name) continue;
            const { board, schema } = ensure(name);
            const metrics = {
                weightKg: set.weightKg,
                reps: set.reps,
                durationSec: set.durationSec,
                distanceMeters: set.distanceMeters,
                heightCm: set.heightCm,
            };
            const oneRm =
                (metrics.weightKg ?? 0) > 0 && (metrics.reps ?? 0) > 0
                    ? calculateOneRM(metrics.weightKg!, metrics.reps!)
                    : null;
            applySetToMetricRecords(board, metrics, schema, oneRm);
        }
    }

    return annotateMetricSessionPrsFromBoards(sets, boards, (name) => ensure(name).schema);
}

/** Annotate a session against already-built all-time metric boards. */
export function annotateMetricSessionPrsFromBoards(
    sets: AnnotatableSet[],
    seedBoards: Map<string, MetricExerciseRecords>,
    schemaFor: (exerciseName: string) => ExerciseTrackingSchema
): Map<string, MetricPrResult> {
    const boards = new Map<string, MetricExerciseRecords>();
    for (const [key, board] of seedBoards) {
        boards.set(key, cloneMetricRecords(board));
    }

    const schemas = new Map<string, ExerciseTrackingSchema>();
    const ensure = (name: string) => {
        const key = exerciseIdentityKey(name) || name.toLowerCase();
        if (!boards.has(key)) {
            boards.set(key, cloneMetricRecords(EMPTY_METRIC_RECORDS));
        }
        if (!schemas.has(key)) {
            schemas.set(key, schemaFor(name));
        }
        return { key, board: boards.get(key)!, schema: schemas.get(key)! };
    };

    const out = new Map<string, MetricPrResult>();
    for (const set of sets) {
        const name = set.exerciseName?.trim() || "";
        if (!name || !set.id) continue;
        const { board, schema } = ensure(name);
        const metrics = {
            weightKg: set.weightKg ?? null,
            reps: set.reps ?? null,
            durationSec: set.durationSec ?? null,
            distanceMeters: set.distanceMeters ?? null,
            heightCm: set.heightCm ?? null,
            resistance: set.resistance ?? null,
            inclinePct: set.inclinePct ?? null,
            calories: set.calories ?? null,
            heartRate: set.heartRate ?? null,
            speedKph: set.speedKph ?? null,
            rpe: set.rpe ?? null,
            rir: set.rir ?? null,
            isWarmup: set.isWarmup,
            isCompleted: set.isCompleted,
        };
        const oneRm =
            (metrics.weightKg ?? 0) > 0 && (metrics.reps ?? 0) > 0
                ? calculateOneRM(metrics.weightKg!, metrics.reps!)
                : null;
        const pr = evaluateMetricAwarePr(metrics, board, schema, oneRm);
        out.set(set.id, pr);
        applySetToMetricRecords(board, metrics, schema, oneRm);
    }
    return out;
}
