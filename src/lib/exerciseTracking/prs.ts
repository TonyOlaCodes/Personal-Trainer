import type { ExerciseTrackingSchema, SetMetrics } from "./types";
import { isFieldEnabled } from "./schema";
import { isSchemaWorkingSet } from "./validation";
import { paceSecPerKm } from "./format";

export type MetricPrKind =
    | "weight"
    | "reps"
    | "oneRm"
    | "duration"
    | "distance"
    | "pace"
    | "height"
    | "heightReps";

export interface MetricExerciseRecords {
    bestWeightKg: number | null;
    bestWeightReps: number | null;
    bestRepsByWeight: Record<string, number>;
    bestOneRm: number | null;
    bestDurationSec: number | null;
    bestDistanceMeters: number | null;
    /** Fastest duration (lowest sec) at exact distance key */
    bestTimeByDistance: Record<string, number>;
    bestHeightCm: number | null;
    bestRepsByHeight: Record<string, number>;
}

export const EMPTY_METRIC_RECORDS: MetricExerciseRecords = {
    bestWeightKg: null,
    bestWeightReps: null,
    bestRepsByWeight: {},
    bestOneRm: null,
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
}

const NO_PR: MetricPrResult = { isPr: false, kind: null, label: null, kinds: [] };

const LABELS: Record<MetricPrKind, string> = {
    oneRm: "🔥 New Best",
    weight: "🔥 Weight PR",
    reps: "💪 Rep PR",
    duration: "⏱️ Duration PR",
    distance: "📏 Distance PR",
    pace: "⚡ Pace PR",
    height: "🔼 Height PR",
    heightReps: "💪 Rep PR",
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

function weightKey(kg: number): string {
    return String(Math.round(kg * 100) / 100);
}

function pickKind(kinds: MetricPrKind[]): MetricPrKind | null {
    for (const k of DISPLAY_PRIORITY) {
        if (kinds.includes(k)) return k;
    }
    return null;
}

/** Import calculateOneRM lazily-compatible — pass precomputed oneRm optional. */
export function applySetToMetricRecords(
    records: MetricExerciseRecords,
    set: SetMetrics,
    schema: ExerciseTrackingSchema,
    oneRm?: number | null
): void {
    if (isFieldEnabled(schema, "weight") && isFieldEnabled(schema, "reps")) {
        const weight = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        if (weight > 0 && reps > 0) {
            if (records.bestWeightKg === null || weight > records.bestWeightKg) {
                records.bestWeightKg = weight;
                records.bestWeightReps = reps;
            } else if (weight === records.bestWeightKg && reps > (records.bestWeightReps ?? 0)) {
                records.bestWeightReps = reps;
            }
            const wKey = weightKey(weight);
            if (reps > (records.bestRepsByWeight[wKey] ?? 0)) {
                records.bestRepsByWeight[wKey] = reps;
            }
            if (oneRm != null && oneRm > (records.bestOneRm ?? 0)) {
                records.bestOneRm = oneRm;
            }
        }
    } else if (isFieldEnabled(schema, "reps") && !isFieldEnabled(schema, "weight")) {
        const reps = set.reps ?? 0;
        if (reps > (records.bestWeightReps ?? 0)) {
            // reuse bestWeightReps as best reps overall for reps-only
            records.bestWeightReps = reps;
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

export function evaluateMetricAwarePr(
    set: SetMetrics & { isWarmup?: boolean | null; isCompleted?: boolean | null },
    records: MetricExerciseRecords | undefined,
    schema: ExerciseTrackingSchema,
    oneRm?: number | null
): MetricPrResult {
    if (!records) return NO_PR;
    if (!isSchemaWorkingSet(set, schema)) return NO_PR;

    const kinds: MetricPrKind[] = [];
    const prEnabled = (key: Parameters<typeof isFieldEnabled>[1]) => {
        const cfg = schema.fields.find((f) => f.key === key);
        return cfg?.enabled && cfg.usedForPr !== false;
    };

    // Strength-style
    if (prEnabled("weight") && prEnabled("reps")) {
        const weight = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        if (weight > 0 && reps > 0) {
            if (records.bestWeightKg === null || weight > records.bestWeightKg) {
                kinds.push("weight");
            }
            const wKey = weightKey(weight);
            const priorBestAtWeight = records.bestRepsByWeight[wKey];
            if (priorBestAtWeight != null && reps > priorBestAtWeight) {
                kinds.push("reps");
            }
            if (oneRm != null && oneRm > (records.bestOneRm ?? 0)) {
                kinds.push("oneRm");
            }
        }
    } else if (prEnabled("reps") && !prEnabled("weight")) {
        const reps = set.reps ?? 0;
        if (reps > 0 && (records.bestWeightReps === null || reps > records.bestWeightReps)) {
            kinds.push("reps");
        }
    }

    if (prEnabled("duration") && (set.durationSec ?? 0) > 0) {
        const d = set.durationSec!;
        // For pure timed holds, longer is better. For distance+time, duration PR at same distance is pace.
        if (!prEnabled("distance")) {
            if (records.bestDurationSec === null || d > records.bestDurationSec) {
                kinds.push("duration");
            }
        }
    }

    if (prEnabled("distance") && (set.distanceMeters ?? 0) > 0) {
        const dist = set.distanceMeters!;
        if (!prEnabled("duration")) {
            if (records.bestDistanceMeters === null || dist > records.bestDistanceMeters) {
                kinds.push("distance");
            }
        } else if ((set.durationSec ?? 0) > 0) {
            const key = distanceKey(dist);
            const t = set.durationSec!;
            const prev = records.bestTimeByDistance[key];
            if (prev == null || t < prev) {
                kinds.push("pace");
            }
            // Also allow longer distance PR when enabled
            if (records.bestDistanceMeters === null || dist > records.bestDistanceMeters) {
                kinds.push("distance");
            }
            void paceSecPerKm;
        }
    }

    if (prEnabled("height") && (set.heightCm ?? 0) > 0) {
        const h = set.heightCm!;
        if (records.bestHeightCm === null || h > records.bestHeightCm) {
            kinds.push("height");
        }
        if (prEnabled("reps") && (set.reps ?? 0) > 0) {
            const key = heightKey(h);
            const prior = records.bestRepsByHeight[key];
            if (prior != null && (set.reps ?? 0) > prior) {
                kinds.push("heightReps");
            }
        }
    }

    const kind = pickKind(kinds);
    return {
        isPr: kinds.length > 0,
        kind,
        label: kind ? LABELS[kind] : null,
        kinds,
    };
}

export function cloneMetricRecords(r: MetricExerciseRecords): MetricExerciseRecords {
    return {
        ...r,
        bestRepsByWeight: { ...r.bestRepsByWeight },
        bestTimeByDistance: { ...r.bestTimeByDistance },
        bestRepsByHeight: { ...r.bestRepsByHeight },
    };
}
