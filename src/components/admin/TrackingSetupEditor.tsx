"use client";

import { cn } from "@/lib/utils";
import {
    FIELD_LABELS,
    PRESET_LABELS,
    TRACKING_FIELDS,
    TRACKING_PRESETS,
    type ExerciseTrackingSchema,
    type TrackingFieldKey,
    type TrackingPreset,
} from "@/lib/exerciseTracking/types";
import { schemaFromPreset, normalizeTrackingSchema } from "@/lib/exerciseTracking/schema";

interface Props {
    value: ExerciseTrackingSchema;
    onChange: (next: ExerciseTrackingSchema) => void;
    className?: string;
}

export function TrackingSetupEditor({ value, onChange, className }: Props) {
    const schema = normalizeTrackingSchema(value);

    const setPreset = (preset: TrackingPreset) => {
        onChange(schemaFromPreset(preset));
    };

    const toggleField = (key: TrackingFieldKey, enabled: boolean) => {
        if (key === "sets") return;
        const fields = schema.fields.map((f) => {
            if (f.key !== key) return f;
            if (!enabled) {
                return { ...f, enabled: false };
            }
            // Turning on: adopt sensible flags from preset defaults / common use
            return {
                ...f,
                enabled: true,
                planTarget: f.planTarget ?? (key !== "pace" && key !== "heartRate" && key !== "calories"),
                usedForPr: f.usedForPr ?? ["weight", "reps", "duration", "distance", "height"].includes(key),
                usedForProgress: f.usedForProgress ?? (key !== "rpe" && key !== "rir" && key !== "heartRate"),
                required: f.required ?? ["weight", "reps", "duration", "distance", "height"].includes(key),
            };
        });
        onChange(normalizeTrackingSchema({ preset: schema.preset === "custom" ? "custom" : schema.preset, fields }));
    };

    const patchField = (
        key: TrackingFieldKey,
        patch: Partial<{ required: boolean; planTarget: boolean; usedForPr: boolean; usedForProgress: boolean }>
    ) => {
        const fields = schema.fields.map((f) => (f.key === key ? { ...f, ...patch } : f));
        onChange(normalizeTrackingSchema({ preset: schema.preset, fields }));
    };

    return (
        <div className={cn("rounded-xl border border-surface-border bg-surface-muted/20 p-4 space-y-4", className)}>
            <div>
                <h4 className="text-sm font-black text-fg tracking-wide">Tracking Setup</h4>
                <p className="text-xs text-fg-muted mt-0.5">
                    Controls how this exercise is logged in plans, workouts, history, and PRs.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Tracking Preset</span>
                <select
                    className="input w-full"
                    value={schema.preset}
                    onChange={(e) => setPreset(e.target.value as TrackingPreset)}
                >
                    {TRACKING_PRESETS.map((p) => (
                        <option key={p} value={p}>
                            {PRESET_LABELS[p]}
                        </option>
                    ))}
                </select>
            </label>

            <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Fields</span>
                <div className="space-y-2">
                    {TRACKING_FIELDS.map((key) => {
                        const f = schema.fields.find((x) => x.key === key)!;
                        const locked = key === "sets";
                        return (
                            <div
                                key={key}
                                className={cn(
                                    "rounded-lg border px-3 py-2",
                                    f.enabled ? "border-surface-border bg-surface-card" : "border-dashed border-surface-border/60 opacity-70"
                                )}
                            >
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-surface-border"
                                        checked={f.enabled}
                                        disabled={locked}
                                        onChange={(e) => toggleField(key, e.target.checked)}
                                    />
                                    <span className="text-sm font-semibold text-fg flex-1">{FIELD_LABELS[key]}</span>
                                    {key === "pace" && (
                                        <span className="text-[10px] text-fg-subtle">Calculated</span>
                                    )}
                                </label>
                                {f.enabled && key !== "sets" && key !== "pace" && (
                                    <div className="mt-2 flex flex-wrap gap-3 pl-6 text-[11px] text-fg-muted">
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(f.required)}
                                                onChange={(e) => patchField(key, { required: e.target.checked })}
                                            />
                                            Required
                                        </label>
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(f.planTarget)}
                                                onChange={(e) => patchField(key, { planTarget: e.target.checked })}
                                            />
                                            Plan target
                                        </label>
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(f.usedForPr)}
                                                onChange={(e) => patchField(key, { usedForPr: e.target.checked })}
                                            />
                                            PRs
                                        </label>
                                        <label className="inline-flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(f.usedForProgress)}
                                                onChange={(e) => patchField(key, { usedForProgress: e.target.checked })}
                                            />
                                            Charts
                                        </label>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function TrackingPresetBadge({ preset }: { preset: TrackingPreset | null | undefined }) {
    const label = preset ? PRESET_LABELS[preset] ?? preset : PRESET_LABELS.strength;
    return (
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-surface-border bg-surface-muted/40 text-fg-subtle">
            {label}
        </span>
    );
}
