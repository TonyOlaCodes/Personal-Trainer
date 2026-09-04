import { schemaFromPreset } from "./presets";
import type { ExerciseTrackingSchema } from "./types";
import { classifyDictionaryTrackingPreset } from "./classify";
import type { TrackingPreset } from "./types";

export function guessTrackingPreset(name: string, muscleGroup?: string | null): TrackingPreset {
    return classifyDictionaryTrackingPreset(name, muscleGroup);
}

export function guessTrackingSchema(
    name: string,
    muscleGroup?: string | null
): ExerciseTrackingSchema {
    return schemaFromPreset(guessTrackingPreset(name, muscleGroup));
}
