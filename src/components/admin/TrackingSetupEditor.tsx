"use client";

import { cn } from "@/lib/utils";
import {
    DICTIONARY_TRACKING_PRESETS,
    FIELD_LABELS,
    PRESET_LABELS,
    isDictionaryTrackingPreset,
    type DictionaryTrackingPreset,
    type ExerciseTrackingSchema,
    type TrackingPreset,
} from "@/lib/exerciseTracking/types";
import { schemaFromPreset, normalizeTrackingSchema, enabledInputFields } from "@/lib/exerciseTracking/schema";

const PRESET_HINTS: Record<DictionaryTrackingPreset, string> = {
    strength: "Sets, optional Weight, Reps, and RPE. Bodyweight work can omit load.",
    timed: "Sets, Duration, and RPE — for holds and timed efforts.",
    distance_time: "Sets, Distance, Duration, and RPE. Either metric can be logged on its own.",
    weight_distance: "Sets, Weight, Distance, Duration, and RPE. Load, distance, and time are optional.",
    height_reps: "Sets, Height, Reps, and RPE — for jumps and similar efforts.",
};

interface Props {
    value: ExerciseTrackingSchema;
    onChange: (next: ExerciseTrackingSchema) => void;
    className?: string;
}

function toDictionaryPreset(preset: TrackingPreset): DictionaryTrackingPreset {
    if (isDictionaryTrackingPreset(preset)) return preset;
    if (preset === "distance" || preset === "cardio") return "distance_time";
    if (preset === "weight_time") return "timed";
    return "strength";
}

export function TrackingSetupEditor({ value, onChange, className }: Props) {
    const schema = normalizeTrackingSchema(value);
    const selected = toDictionaryPreset(schema.preset);
    const display = schemaFromPreset(selected);
    const fieldsSummary = enabledInputFields(display)
        .filter((key) => key !== "pace")
        .map((key) => FIELD_LABELS[key]);

    return (
        <div className={cn("rounded-xl border border-surface-border bg-surface-muted/20 p-4 space-y-4", className)}>
            <div>
                <h4 className="text-sm font-black text-fg tracking-wide">Tracking</h4>
                <p className="text-xs text-fg-muted mt-0.5">
                    Choose how this exercise is logged. Fields, plan targets, history, and PRs follow this type.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                    Tracking Type
                </span>
                <select
                    className="input w-full"
                    value={selected}
                    onChange={(e) => onChange(schemaFromPreset(e.target.value as DictionaryTrackingPreset))}
                >
                    {DICTIONARY_TRACKING_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>
                            {PRESET_LABELS[preset]}
                        </option>
                    ))}
                </select>
            </label>

            <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                    Includes
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {["Sets", ...fieldsSummary].map((label) => (
                        <span
                            key={label}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-surface-muted border border-surface-border text-fg"
                        >
                            {label}
                        </span>
                    ))}
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">{PRESET_HINTS[selected]}</p>
            </div>
        </div>
    );
}

export function TrackingPresetBadge({ preset }: { preset: TrackingPreset | null | undefined }) {
    const simple = preset ? toDictionaryPreset(preset) : "strength";
    return (
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-surface-border bg-surface-muted/40 text-fg-subtle">
            {PRESET_LABELS[simple]}
        </span>
    );
}
