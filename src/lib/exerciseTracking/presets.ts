import type {
    ExerciseTrackingSchema,
    TrackingFieldConfig,
    TrackingFieldKey,
    TrackingPreset,
} from "./types";
import { TRACKING_FIELDS } from "./types";

function field(
    key: TrackingFieldKey,
    opts: Partial<Omit<TrackingFieldConfig, "key" | "enabled">> & { enabled?: boolean } = {}
): TrackingFieldConfig {
    return {
        key,
        enabled: opts.enabled ?? true,
        required: opts.required,
        planTarget: opts.planTarget,
        usedForPr: opts.usedForPr,
        usedForProgress: opts.usedForProgress,
    };
}

function disabled(key: TrackingFieldKey): TrackingFieldConfig {
    return { key, enabled: false };
}

/** Defaults for each preset — admin can toggle fields after selecting. */
export const PRESET_DEFAULTS: Record<TrackingPreset, TrackingFieldConfig[]> = {
    strength: [
        field("sets", { required: true, planTarget: true }),
        field("weight", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("reps", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("duration"),
        disabled("distance"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    reps_only: [
        field("sets", { required: true, planTarget: true }),
        field("reps", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("duration"),
        disabled("distance"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    timed: [
        field("sets", { required: true, planTarget: true }),
        field("duration", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("reps"),
        disabled("distance"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    distance: [
        field("sets", { required: true, planTarget: true }),
        field("distance", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("reps"),
        disabled("duration"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    distance_time: [
        field("sets", { required: true, planTarget: true }),
        field("distance", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("duration", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("pace", { usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("reps"),
        disabled("rir"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    weight_distance: [
        field("sets", { required: true, planTarget: true }),
        field("weight", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("distance", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("duration", { planTarget: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("reps"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    weight_time: [
        field("sets", { required: true, planTarget: true }),
        field("weight", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("duration", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("reps"),
        disabled("distance"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("height"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    height_reps: [
        field("sets", { required: true, planTarget: true }),
        field("height", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("reps", { required: true, planTarget: true, usedForPr: true, usedForProgress: true }),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("duration"),
        disabled("distance"),
        disabled("rir"),
        disabled("pace"),
        disabled("speed"),
        disabled("resistance"),
        disabled("incline"),
        disabled("calories"),
        disabled("heartRate"),
    ],
    cardio: [
        field("sets", { required: true, planTarget: true }),
        field("duration", { planTarget: true, usedForPr: true, usedForProgress: true }),
        field("distance", { planTarget: true, usedForPr: true, usedForProgress: true }),
        field("pace", { usedForProgress: true }),
        field("speed", { planTarget: true, usedForProgress: true }),
        field("resistance", { planTarget: true }),
        field("incline", { planTarget: true }),
        field("calories", { usedForProgress: true }),
        field("heartRate"),
        field("rpe", { planTarget: true }),
        disabled("weight"),
        disabled("reps"),
        disabled("rir"),
        disabled("height"),
    ],
    custom: TRACKING_FIELDS.map((key) =>
        key === "sets"
            ? field("sets", { required: true, planTarget: true })
            : disabled(key)
    ),
};

export function schemaFromPreset(preset: TrackingPreset): ExerciseTrackingSchema {
    return {
        preset,
        fields: PRESET_DEFAULTS[preset].map((f) => ({ ...f })),
    };
}

export const DEFAULT_STRENGTH_SCHEMA = schemaFromPreset("strength");
