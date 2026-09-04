/** Canonical tracking field keys stored in the dictionary / logs. */
export const TRACKING_FIELDS = [
    "sets",
    "weight",
    "reps",
    "duration",
    "distance",
    "rpe",
    "rir",
    "pace",
    "speed",
    "height",
    "resistance",
    "incline",
    "calories",
    "heartRate",
] as const;

export type TrackingFieldKey = (typeof TRACKING_FIELDS)[number];

export const TRACKING_PRESETS = [
    "strength",
    "reps_only",
    "timed",
    "distance",
    "distance_time",
    "weight_distance",
    "weight_time",
    "height_reps",
    "cardio",
    "custom",
] as const;

export type TrackingPreset = (typeof TRACKING_PRESETS)[number];

export interface TrackingFieldConfig {
    key: TrackingFieldKey;
    enabled: boolean;
    /** Required when logging a completed set (sets column is structural). */
    required?: boolean;
    /** Show as a plan target input. */
    planTarget?: boolean;
    /** Eligible for PR detection for this exercise. */
    usedForPr?: boolean;
    /** Eligible for progression charts. */
    usedForProgress?: boolean;
}

export interface ExerciseTrackingSchema {
    preset: TrackingPreset;
    fields: TrackingFieldConfig[];
}

/** Canonical numeric metrics for one logged set (DB / API). */
export interface SetMetrics {
    weightKg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
}

/** Plan-level targets for an exercise (canonical units). */
export interface ExercisePlanTargets {
    sets: number;
    reps?: string | null;
    weightTargetKg?: number | null;
    targetDurationSec?: number | null;
    targetDistanceMeters?: number | null;
    targetHeightCm?: number | null;
    targetRpe?: number | null;
    targetResistance?: number | null;
    targetInclinePct?: number | null;
}

export const PRESET_LABELS: Record<TrackingPreset, string> = {
    strength: "Strength",
    reps_only: "Reps Only",
    timed: "Timed",
    distance: "Distance",
    distance_time: "Distance + Time",
    weight_distance: "Weight + Distance",
    weight_time: "Weight + Time",
    height_reps: "Height + Reps",
    cardio: "Cardio",
    custom: "Custom",
};

export const FIELD_LABELS: Record<TrackingFieldKey, string> = {
    sets: "Sets",
    weight: "Weight",
    reps: "Reps",
    duration: "Duration",
    distance: "Distance",
    rpe: "RPE",
    rir: "RIR",
    pace: "Pace",
    speed: "Speed",
    height: "Height",
    resistance: "Resistance / Level",
    incline: "Incline",
    calories: "Calories",
    heartRate: "Heart Rate",
};
