import type { TrackingPreset } from "./types";
import { schemaFromPreset } from "./presets";
import type { ExerciseTrackingSchema } from "./types";

/**
 * Best-effort preset guesses for known movement names during migration.
 * Unknown names stay Strength so existing plans/logs keep working.
 */
const NAME_PRESET_RULES: Array<{ test: RegExp; preset: TrackingPreset }> = [
    { test: /\b(dead hang|plank|wall sit|hollow hold|l.?sit|hang)\b/i, preset: "timed" },
    { test: /\b(weighted dead hang|farmers? carry|farmer'?s carry|suitcase carry|yoke walk)\b/i, preset: "weight_distance" },
    { test: /\b(box jump|depth jump|hurdle jump)\b/i, preset: "height_reps" },
    { test: /\b(sprint|100m|200m|400m|shuttle)\b/i, preset: "distance_time" },
    { test: /\b(run(ning)?|jog(ging)?|row(ing)?|cycle|cycling|bike|treadmill|elliptical|stair|assault)\b/i, preset: "cardio" },
    { test: /\b(push[- ]?up|pull[- ]?up|chin[- ]?up|dip|sit[- ]?up|crunch|burpee)\b/i, preset: "reps_only" },
    { test: /\b(broad jump|standing long jump)\b/i, preset: "distance" },
];

/** More specific rules first — weight_distance before timed for "weighted dead hang". */
const ORDERED_RULES = [
    { test: /\bweighted dead hang\b/i, preset: "weight_time" as TrackingPreset },
    { test: /\b(farmers?|farmer'?s|suitcase)\s+carry\b/i, preset: "weight_distance" as TrackingPreset },
    { test: /\byoke\s+(carry|walk)\b/i, preset: "weight_distance" as TrackingPreset },
    ...NAME_PRESET_RULES,
];

export function guessTrackingPreset(name: string, muscleGroup?: string | null): TrackingPreset {
    const n = name.trim();
    if (!n) return "strength";

    for (const rule of ORDERED_RULES) {
        if (rule.test.test(n)) return rule.preset;
    }

    if (muscleGroup?.toLowerCase() === "cardio") return "cardio";
    return "strength";
}

export function guessTrackingSchema(
    name: string,
    muscleGroup?: string | null
): ExerciseTrackingSchema {
    return schemaFromPreset(guessTrackingPreset(name, muscleGroup));
}
