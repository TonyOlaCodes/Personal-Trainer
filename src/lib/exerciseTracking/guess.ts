import type { TrackingPreset } from "./types";
import { schemaFromPreset } from "./presets";
import type { ExerciseTrackingSchema } from "./types";

/**
 * Best-effort preset guesses for known movement names.
 * Admin UI only exposes Strength / Timed; other legacy presets still resolve from DB.
 */
const ORDERED_RULES: Array<{ test: RegExp; preset: TrackingPreset }> = [
    { test: /\b(dead hang|plank|wall sit|hollow hold|l.?sit|hang|handstand hold)\b/i, preset: "timed" },
    { test: /\b(farmers?|farmer'?s|suitcase)\s+carry\b/i, preset: "strength" },
    { test: /\byoke\s+(carry|walk)\b/i, preset: "strength" },
    { test: /\b(sprint|run(ning)?|jog(ging)?|row(ing)?|cycle|cycling|bike|treadmill|elliptical|stair|assault)\b/i, preset: "timed" },
];

export function guessTrackingPreset(name: string, muscleGroup?: string | null): TrackingPreset {
    const n = name.trim();
    if (!n) return "strength";

    for (const rule of ORDERED_RULES) {
        if (rule.test.test(n)) return rule.preset;
    }

    if (muscleGroup?.toLowerCase() === "cardio") return "timed";
    return "strength";
}

export function guessTrackingSchema(
    name: string,
    muscleGroup?: string | null
): ExerciseTrackingSchema {
    return schemaFromPreset(guessTrackingPreset(name, muscleGroup));
}
