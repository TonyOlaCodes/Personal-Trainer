/**
 * Metric-aware PR evaluation for non-strength tracking schemas.
 * Strength (weight + reps) delegates to the canonical exercisePrs engine.
 */

import {
    applySetToRecords,
    cloneExerciseRecords,
    EMPTY_EXERCISE_RECORDS,
    evaluateSetPr,
    formatStrengthPrLabel,
    type ExerciseRecords,
    type PrKind,
    type SetPrResult,
} from "@/lib/exercisePrs";
import type { ExerciseTrackingSchema, SetMetrics } from "./types";
import { isFieldEnabled } from "./schema";
import { isSchemaWorkingSet } from "./validation";
import { calculateOneRM } from "@/lib/oneRepMax";

export type MetricPrKind =
    | PrKind
    | "duration"
    | "distance"
    | "pace"
    | "height"
    | "heightReps";

export interface MetricExerciseRecords {
    strength: ExerciseRecords;
    bestDurationSec: number | null;
    bestDistanceMeters: number | null;
    /** Fastest duration (lowest sec) at exact distance key */
    bestTimeByDistance: Record<string, number>;
    bestHeightCm: number | null;
    bestRepsByHeight: Record<string, number>;
}

export const EMPTY_METRIC_RECORDS: MetricExerciseRecords = {
    strength: { ...EMPTY_EXERCISE_RECORDS, bestWeightByReps: {} },
    bestDurationSec: null,
    bestDistanceMeters: null,
    bestTimeByDistance: {},
    bestHeightCm: null,
    bestRepsByHeight: {},
};

export interface MetricPrResult {
    isPr: boolean;
    kind: MetricPrKind | null;
    label: string | null;
    kinds: MetricPrKind[];
    repCount?: number | null;
    alsoKinds?: MetricPrKind[];
}

const NO_PR: MetricPrResult = {
    isPr: false,
    kind: null,
    label: null,
    kinds: [],
    repCount: null,
    alsoKinds: [],
};

const LABELS: Record<Exclude<MetricPrKind, PrKind>, string> = {
    duration: "DURATION PR",
    distance: "DISTANCE PR",
    pace: "TIME PR",
    height: "HEIGHT PR",
    heightReps: "REP PR",
};

const DISPLAY_PRIORITY: MetricPrKind[] = [
    "oneRm",
    "pace",
    "weight",
    "duration",
    "height",
    "distance",
    "reps",
    "heightReps",
];

function distanceKey(meters: number): string {
    return String(Math.round(meters * 100) / 100);
}

function heightKey(cm: number): string {
    return String(Math.round(cm * 100) / 100);
}

function pickKind(kinds: MetricPrKind[]): MetricPrKind | null {
    for (const k of DISPLAY_PRIORITY) {
        if (kinds.includes(k)) return k;
    }
    return null;
}

function formatMetricLabel(kind: MetricPrKind, reps?: number | null): string {
    if (kind === "oneRm" || kind === "weight" || kind === "reps") {
        return formatStrengthPrLabel(kind, reps);
    }
    return LABELS[kind];
}

export function cloneMetricRecords(r: MetricExerciseRecords): MetricExerciseRecords {
    return {
        strength: cloneExerciseRecords(r.strength),
        bestDurationSec: r.bestDurationSec,
        bestDistanceMeters: r.bestDistanceMeters,
        bestTimeByDistance: { ...r.bestTimeByDistance },
        bestHeightCm: r.bestHeightCm,
        bestRepsByHeight: { ...r.bestRepsByHeight },
    };
}

export function applySetToMetricRecords(
    records: MetricExerciseRecords,
    set: SetMetrics,
    schema: ExerciseTrackingSchema,
    oneRm?: number | null
): void {
    void oneRm;
    if (isFieldEnabled(schema, "weight") && isFieldEnabled(schema, "reps")) {
        applySetToRecords(records.strength, set);
        return;
    }

    if (isFieldEnabled(schema, "reps") && !isFieldEnabled(schema, "weight")) {
        const reps = set.reps ?? 0;
        if (reps > (records.strength.bestWeightReps ?? 0)) {
            records.strength.bestWeightReps = reps;
        }
    }

    if (isFieldEnabled(schema, "duration") && (set.durationSec ?? 0) > 0) {
        const d = set.durationSec!;
        if (records.bestDurationSec === null || d > records.bestDurationSec) {
            records.bestDurationSec = d;
        }
    }

    if (isFieldEnabled(schema, "distance") && (set.distanceMeters ?? 0) > 0) {
        const dist = set.distanceMeters!;
        if (records.bestDistanceMeters === null || dist > records.bestDistanceMeters) {
            records.bestDistanceMeters = dist;
        }
        if (isFieldEnabled(schema, "duration") && (set.durationSec ?? 0) > 0) {
            const key = distanceKey(dist);
            const t = set.durationSec!;
            if (!(key in records.bestTimeByDistance) || t < records.bestTimeByDistance[key]) {
                records.bestTimeByDistance[key] = t;
            }
        }
    }

    if (isFieldEnabled(schema, "height") && (set.heightCm ?? 0) > 0) {
        const h = set.heightCm!;
        if (records.bestHeightCm === null || h > records.bestHeightCm) {
            records.bestHeightCm = h;
        }
        if (isFieldEnabled(schema, "reps") && (set.reps ?? 0) > 0) {
            const key = heightKey(h);
            const reps = set.reps!;
            if (reps > (records.bestRepsByHeight[key] ?? 0)) {
                records.bestRepsByHeight[key] = reps;
            }
        }
    }
}

function prEnabled(schema: ExerciseTrackingSchema, key: Parameters<typeof isFieldEnabled>[1]) {
    const cfg = schema.fields.find((f) => f.key === key);
    return Boolean(cfg?.enabled && cfg.usedForPr !== false);
}

export function evaluateMetricAwarePr(
    set: SetMetrics & { isWarmup?: boolean | null; isCompleted?: boolean | null },
    records: MetricExerciseRecords | undefined,
    schema: ExerciseTrackingSchema,
    oneRm?: number | null
): MetricPrResult {
    void oneRm;
    if (!records) return NO_PR;
    if (!isSchemaWorkingSet(set, schema)) return NO_PR;

    // Strength path — single canonical engine
    if (prEnabled(schema, "weight") && prEnabled(schema, "reps")) {
        const strengthPr: SetPrResult = evaluateSetPr(set, records.strength);
        if (!strengthPr.isPr) return NO_PR;
        return {
            isPr: true,
            kind: strengthPr.kind,
            label: strengthPr.label,
            kinds: strengthPr.kinds,
            repCount: strengthPr.repCount,
            alsoKinds: strengthPr.alsoKinds,
        };
    }

    const kinds: MetricPrKind[] = [];

    if (prEnabled(schema, "reps") && !prEnabled(schema, "weight")) {
        const reps = set.reps ?? 0;
        if (reps > 0 && records.strength.bestWeightReps != null && reps > records.strength.bestWeightReps) {
            kinds.push("reps");
        }
    }

    if (prEnabled(schema, "duration") && (set.durationSec ?? 0) > 0) {
        const d = set.durationSec!;
        const hasDistanceValue = prEnabled(schema, "distance") && (set.distanceMeters ?? 0) > 0;
        if (!hasDistanceValue) {
            if (records.bestDurationSec != null && d > records.bestDurationSec) {
                kinds.push("duration");
            }
        }
    }

    if (prEnabled(schema, "distance") && (set.distanceMeters ?? 0) > 0) {
        const dist = set.distanceMeters!;
        if (!prEnabled(schema, "duration") || !(set.durationSec ?? 0)) {
            if (records.bestDistanceMeters != null && dist > records.bestDistanceMeters) {
                kinds.push("distance");
            }
        } else if ((set.durationSec ?? 0) > 0) {
            const key = distanceKey(dist);
            const t = set.durationSec!;
            const prev = records.bestTimeByDistance[key];
            // Pace/time PR only when that distance already has a prior time to beat
            if (prev != null && t < prev) {
                kinds.push("pace");
            }
            if (records.bestDistanceMeters != null && dist > records.bestDistanceMeters) {
                kinds.push("distance");
            }
        }
    }

    if (prEnabled(schema, "height") && (set.heightCm ?? 0) > 0) {
        const h = set.heightCm!;
        if (records.bestHeightCm != null && h > records.bestHeightCm) {
            kinds.push("height");
        }
        if (prEnabled(schema, "reps") && (set.reps ?? 0) > 0) {
            const key = heightKey(h);
            const prior = records.bestRepsByHeight[key];
            if (prior != null && (set.reps ?? 0) > prior) {
                kinds.push("heightReps");
            }
        }
    }

    const kind = pickKind(kinds);
    if (!kind) return NO_PR;
    const alsoKinds = kinds.filter((k) => k !== kind);
    return {
        isPr: true,
        kind,
        label: formatMetricLabel(kind, set.reps),
        kinds,
        repCount: kinds.includes("reps") || kinds.includes("heightReps") ? set.reps ?? null : null,
        alsoKinds,
    };
}

/** @deprecated Prefer calculateOneRM from oneRepMax — kept for call-site compatibility. */
export function computeOneRm(weightKg: number, reps: number): number {
    return calculateOneRM(weightKg, reps);
}
