"use client";

import { cn } from "@/lib/utils";
import {
    PRESET_LABELS,
    type ExerciseTrackingSchema,
    type TrackingPreset,
} from "@/lib/exerciseTracking/types";
import { schemaFromPreset, normalizeTrackingSchema } from "@/lib/exerciseTracking/schema";

/** Admin-facing presets — keep the internal schema flexible for future types. */
const SIMPLE_PRESETS: TrackingPreset[] = ["strength", "timed"];

const PRESET_HINTS: Record<"strength" | "timed", string> = {
    strength: "Sets, Weight, Reps, and RPE — used for PRs and progression automatically.",
    timed: "Sets, Duration, and RPE — for holds and timed efforts.",
};

interface Props {
    value: ExerciseTrackingSchema;
    onChange: (next: ExerciseTrackingSchema) => void;
    className?: string;
}

function toSimplePreset(preset: TrackingPreset): "strength" | "timed" {
    if (preset === "timed") return "timed";
    // Legacy cardio / distance / holds that were duration-led → Timed when admin re-saves.
    if (
        preset === "distance"
        || preset === "distance_time"
        || preset === "cardio"
    ) {
        return "timed";
    }
    return "strength";
}

export function TrackingSetupEditor({ value, onChange, className }: Props) {
    const schema = normalizeTrackingSchema(value);
    const selected = toSimplePreset(schema.preset);
    const fieldsSummary =
        selected === "strength"
            ? ["Sets", "Weight", "Reps", "RPE"]
            : ["Sets", "Duration", "RPE"];

    const setPreset = (preset: "strength" | "timed") => {
        onChange(schemaFromPreset(preset));
    };

    return (
        <div className={cn("rounded-xl border border-surface-border bg-surface-muted/20 p-4 space-y-4", className)}>
            <div>
                <h4 className="text-sm font-black text-fg tracking-wide">Tracking</h4>
                <p className="text-xs text-fg-muted mt-0.5">
                    Choose how this exercise is logged. Plan targets, workouts, history, and PRs follow automatically.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                    Tracking Type
                </span>
                <select
                    className="input w-full"
                    value={selected}
                    onChange={(e) => setPreset(e.target.value as "strength" | "timed")}
                >
                    {SIMPLE_PRESETS.map((p) => (
                        <option key={p} value={p}>
                            {PRESET_LABELS[p]}
                        </option>
                    ))}
                </select>
            </label>

            <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                    Includes
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {fieldsSummary.map((label) => (
                        <span
                            key={label}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-surface-muted border border-surface-border text-fg"
                        >
                            {label}
                        </span>
                    ))}
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">{PRESET_HINTS[selected]}</p>
                {schema.preset !== selected && (
                    <p className="text-[11px] text-warning">
                        Previously stored as {PRESET_LABELS[schema.preset] ?? schema.preset}. Saving a type
                        above will switch to the simplified setup (historical logs stay intact).
                    </p>
                )}
            </div>
        </div>
    );
}

export function TrackingPresetBadge({ preset }: { preset: TrackingPreset | null | undefined }) {
    const simple = preset ? toSimplePreset(preset) : "strength";
    const label = PRESET_LABELS[simple];
    return (
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-surface-border bg-surface-muted/40 text-fg-subtle">
            {label}
        </span>
    );
}
