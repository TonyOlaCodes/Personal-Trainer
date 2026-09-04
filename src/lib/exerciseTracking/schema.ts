import type {
    ExerciseTrackingSchema,
    TrackingFieldConfig,
    TrackingFieldKey,
    TrackingPreset,
} from "./types";
import { TRACKING_FIELDS, TRACKING_PRESETS } from "./types";
import { DEFAULT_STRENGTH_SCHEMA, PRESET_DEFAULTS, schemaFromPreset } from "./presets";

function isPreset(value: unknown): value is TrackingPreset {
    return typeof value === "string" && (TRACKING_PRESETS as readonly string[]).includes(value);
}

function isFieldKey(value: unknown): value is TrackingFieldKey {
    return typeof value === "string" && (TRACKING_FIELDS as readonly string[]).includes(value);
}

/** Merge stored config with a full field list so new fields are easy to add later. */
export function normalizeTrackingSchema(
    input: Partial<ExerciseTrackingSchema> | null | undefined
): ExerciseTrackingSchema {
    const preset = isPreset(input?.preset) ? input!.preset : "strength";
    const defaults = PRESET_DEFAULTS[preset];
    const byKey = new Map<TrackingFieldKey, TrackingFieldConfig>();

    for (const f of defaults) {
        byKey.set(f.key, { ...f });
    }

    if (Array.isArray(input?.fields)) {
        for (const raw of input!.fields!) {
            if (!raw || !isFieldKey(raw.key)) continue;
            const base = byKey.get(raw.key) ?? { key: raw.key, enabled: false };
            byKey.set(raw.key, {
                key: raw.key,
                enabled: Boolean(raw.enabled),
                required: raw.required ?? base.required,
                planTarget: raw.planTarget ?? base.planTarget,
                usedForPr: raw.usedForPr ?? base.usedForPr,
                usedForProgress: raw.usedForProgress ?? base.usedForProgress,
            });
        }
    }

    // Sets are always present as a structural concept for logging rows.
    const sets = byKey.get("sets");
    if (sets) {
        sets.enabled = true;
        sets.required = true;
        sets.planTarget = true;
    }

    const fields = TRACKING_FIELDS.map(
        (key) => byKey.get(key) ?? { key, enabled: false }
    );

    return { preset, fields };
}

export function parseTrackingSchemaFromDb(row: {
    trackingPreset?: string | null;
    trackingFields?: string | null;
}): ExerciseTrackingSchema {
    if (!row.trackingPreset && !row.trackingFields) {
        return { ...DEFAULT_STRENGTH_SCHEMA, fields: DEFAULT_STRENGTH_SCHEMA.fields.map((f) => ({ ...f })) };
    }

    let fields: TrackingFieldConfig[] | undefined;
    if (row.trackingFields) {
        try {
            const parsed = JSON.parse(row.trackingFields) as unknown;
            if (Array.isArray(parsed)) fields = parsed as TrackingFieldConfig[];
        } catch {
            fields = undefined;
        }
    }

    return normalizeTrackingSchema({
        preset: isPreset(row.trackingPreset) ? row.trackingPreset : "strength",
        fields,
    });
}

export function serializeTrackingFields(schema: ExerciseTrackingSchema): string {
    return JSON.stringify(normalizeTrackingSchema(schema).fields);
}

export function isFieldEnabled(schema: ExerciseTrackingSchema, key: TrackingFieldKey): boolean {
    return schema.fields.find((f) => f.key === key)?.enabled === true;
}

export function enabledLogFields(schema: ExerciseTrackingSchema): TrackingFieldKey[] {
    return schema.fields
        .filter((f) => f.enabled && f.key !== "sets" && f.key !== "pace")
        .map((f) => f.key);
}

/** Pace is calculated — never a manual log column. */
export function enabledInputFields(schema: ExerciseTrackingSchema): TrackingFieldKey[] {
    return schema.fields
        .filter((f) => f.enabled && f.key !== "sets" && f.key !== "pace")
        .map((f) => f.key);
}

export function enabledPlanTargetFields(schema: ExerciseTrackingSchema): TrackingFieldKey[] {
    return schema.fields
        .filter((f) => f.enabled && f.planTarget && f.key !== "sets" && f.key !== "pace")
        .map((f) => f.key);
}

export function usesStrengthOneRm(schema: ExerciseTrackingSchema): boolean {
    return isFieldEnabled(schema, "weight") && isFieldEnabled(schema, "reps");
}

export function usesLegacyCardioOverload(schema: ExerciseTrackingSchema): boolean {
    // Old cardio UI overloaded weightKg/reps — new schema uses duration/distance/etc.
    return schema.preset === "cardio";
}

export { schemaFromPreset };
