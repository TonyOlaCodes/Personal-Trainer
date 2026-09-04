import type { ExerciseTrackingSchema, SetMetrics, TrackingFieldKey } from "./types";
import { isFieldEnabled } from "./schema";

function nonNegNumber(value: unknown): number | null {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

function intInRange(value: unknown, min: number, max: number): number | null {
    const n = nonNegNumber(value);
    if (n == null) return null;
    const i = Math.round(n);
    if (i < min || i > max) return null;
    return i;
}

/** Normalize API / form payloads into canonical SetMetrics. */
export function coerceSetMetrics(raw: Partial<Record<string, unknown>>): SetMetrics {
    return {
        weightKg: nonNegNumber(raw.weightKg),
        reps: intInRange(raw.reps, 0, 10000),
        rpe: intInRange(raw.rpe, 1, 10),
        rir: nonNegNumber(raw.rir),
        durationSec: nonNegNumber(raw.durationSec),
        distanceMeters: nonNegNumber(raw.distanceMeters),
        heightCm: nonNegNumber(raw.heightCm),
        resistance: nonNegNumber(raw.resistance),
        inclinePct: nonNegNumber(raw.inclinePct),
        calories: nonNegNumber(raw.calories),
        heartRate: intInRange(raw.heartRate, 0, 250),
        speedKph: nonNegNumber(raw.speedKph),
    };
}

const FIELD_TO_METRIC: Partial<Record<TrackingFieldKey, keyof SetMetrics>> = {
    weight: "weightKg",
    reps: "reps",
    rpe: "rpe",
    rir: "rir",
    duration: "durationSec",
    distance: "distanceMeters",
    height: "heightCm",
    resistance: "resistance",
    incline: "inclinePct",
    calories: "calories",
    heartRate: "heartRate",
    speed: "speedKph",
};

export function metricValue(set: SetMetrics, field: TrackingFieldKey): number | null {
    const key = FIELD_TO_METRIC[field];
    if (!key) return null;
    const v = set[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * A set has "performed" data when at least one enabled primary metric is present.
 * Does not require every required field (user may still be typing).
 */
export function hasPerformedMetrics(
    set: SetMetrics,
    schema: ExerciseTrackingSchema
): boolean {
    const primary: TrackingFieldKey[] = [
        "weight",
        "reps",
        "duration",
        "distance",
        "height",
        "speed",
        "resistance",
        "calories",
    ];
    for (const key of primary) {
        if (!isFieldEnabled(schema, key)) continue;
        const v = metricValue(set, key);
        if (v != null && v > 0) return true;
    }
    // Historical strength fallback
    if ((set.weightKg ?? 0) > 0 || (set.reps ?? 0) > 0) return true;
    if ((set.durationSec ?? 0) > 0 || (set.distanceMeters ?? 0) > 0) return true;
    return false;
}

/** Completed working set for PR / history — requires enabled required fields (except RPE). */
export function isSchemaWorkingSet(
    set: SetMetrics & { isWarmup?: boolean | null; isCompleted?: boolean | null },
    schema: ExerciseTrackingSchema
): boolean {
    if (set.isWarmup) return false;
    if (set.isCompleted === false) return false;

    const required = schema.fields.filter(
        (f) => f.enabled && f.required && f.key !== "sets" && f.key !== "pace" && f.key !== "rpe"
    );

    if (required.length === 0) {
        return hasPerformedMetrics(set, schema);
    }

    for (const f of required) {
        const v = metricValue(set, f.key);
        if (v == null || v <= 0) return false;
    }
    return true;
}

export function validateSetMetrics(
    set: SetMetrics,
    schema: ExerciseTrackingSchema
): { ok: true } | { ok: false; error: string } {
    for (const f of schema.fields) {
        if (!f.enabled) continue;
        const v = metricValue(set, f.key);
        if (v == null) continue;

        if (f.key === "rpe" && (v < 1 || v > 10)) {
            return { ok: false, error: "RPE must be between 1 and 10" };
        }
        if (f.key === "reps" && (!Number.isInteger(v) || v < 0)) {
            return { ok: false, error: "Reps must be a non-negative integer" };
        }
        if (["weight", "duration", "distance", "height", "speed", "calories"].includes(f.key) && v < 0) {
            return { ok: false, error: `${f.key} must be non-negative` };
        }
    }

    return { ok: true };
}
