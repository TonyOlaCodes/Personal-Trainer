"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { ALL_MUSCLE_REGIONS, MUSCLE_REGION_LABELS, type MuscleRegion } from "@/lib/muscleRegions";
import {
    MUSCLE_CONTRIBUTION_LEVELS,
    MUSCLE_CONTRIBUTION_LABELS,
    type MuscleContributionLevel,
} from "@/lib/muscleContribution";
import {
    hitToTargets,
    normalizeMuscleTargets,
    type MuscleTargetEntry,
} from "@/lib/muscleTargetEntries";
import { musclesForExercise } from "@/lib/exerciseMuscles";
import { cn } from "@/lib/utils";

interface Props {
    value: MuscleTargetEntry[];
    onChange: (next: MuscleTargetEntry[]) => void;
    exerciseName?: string;
    muscleGroup?: string | null;
    className?: string;
}

export function MuscleTargetsEditor({
    value,
    onChange,
    exerciseName,
    muscleGroup,
    className,
}: Props) {
    const targets = normalizeMuscleTargets(value);
    const [adding, setAdding] = useState(false);
    const [draftRegion, setDraftRegion] = useState<MuscleRegion | "">("");
    const [draftLevel, setDraftLevel] = useState<MuscleContributionLevel>("primary");

    const assignedRegions = useMemo(
        () => new Set(targets.map((t) => t.region)),
        [targets]
    );
    const availableRegions = ALL_MUSCLE_REGIONS.filter((r) => !assignedRegions.has(r));

    const setRegionLevel = (region: MuscleRegion, level: MuscleContributionLevel) => {
        const next = targets.filter((t) => t.region !== region);
        next.push({ region, level });
        onChange(normalizeMuscleTargets(next));
    };

    const removeRegion = (region: MuscleRegion) => {
        onChange(normalizeMuscleTargets(targets.filter((t) => t.region !== region)));
    };

    const addMuscle = () => {
        if (!draftRegion) return;
        setRegionLevel(draftRegion, draftLevel);
        setDraftRegion("");
        setDraftLevel("secondary");
        setAdding(false);
    };

    const fillFromCategory = () => {
        const hit = musclesForExercise(exerciseName, muscleGroup);
        onChange(hitToTargets(hit));
    };

    return (
        <div className={cn("rounded-xl border border-surface-border bg-surface-muted/20 p-4 space-y-3", className)}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h4 className="text-sm font-black text-fg tracking-wide">Muscle Targets</h4>
                    <p className="text-xs text-fg-muted mt-0.5">
                        Only muscles this exercise meaningfully trains.
                    </p>
                </div>
                <button type="button" onClick={fillFromCategory} className="btn-secondary btn-sm shrink-0">
                    Fill defaults
                </button>
            </div>

            <div className="space-y-2">
                {targets.length === 0 && (
                    <p className="text-xs text-fg-subtle py-2">
                        No muscles assigned yet. Add muscles or fill defaults from the exercise category.
                    </p>
                )}
                {targets.map((entry) => (
                    <div
                        key={entry.region}
                        className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-2"
                    >
                        <span className="text-sm font-semibold text-fg flex-1 min-w-0 truncate">
                            {MUSCLE_REGION_LABELS[entry.region]}
                        </span>
                        <select
                            className="input input-sm w-[7.5rem] shrink-0"
                            value={entry.level}
                            onChange={(e) =>
                                setRegionLevel(entry.region, e.target.value as MuscleContributionLevel)
                            }
                        >
                            {MUSCLE_CONTRIBUTION_LEVELS.map((l) => (
                                <option key={l} value={l}>
                                    {MUSCLE_CONTRIBUTION_LABELS[l]}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => removeRegion(entry.region)}
                            className="btn-ghost p-1.5 text-fg-subtle hover:text-danger"
                            aria-label={`Remove ${MUSCLE_REGION_LABELS[entry.region]}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {adding ? (
                <div className="rounded-lg border border-brand-500/30 bg-surface-card p-3 space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                        <select
                            className="input"
                            value={draftRegion}
                            onChange={(e) => setDraftRegion(e.target.value as MuscleRegion | "")}
                        >
                            <option value="">Select muscle…</option>
                            {availableRegions.map((r) => (
                                <option key={r} value={r}>
                                    {MUSCLE_REGION_LABELS[r]}
                                </option>
                            ))}
                        </select>
                        <select
                            className="input"
                            value={draftLevel}
                            onChange={(e) => setDraftLevel(e.target.value as MuscleContributionLevel)}
                        >
                            {MUSCLE_CONTRIBUTION_LEVELS.map((l) => (
                                <option key={l} value={l}>
                                    {MUSCLE_CONTRIBUTION_LABELS[l]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button type="button" className="btn-ghost text-xs" onClick={() => setAdding(false)}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-primary text-xs"
                            disabled={!draftRegion}
                            onClick={addMuscle}
                        >
                            Add
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    disabled={availableRegions.length === 0}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 disabled:opacity-40"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Muscle
                </button>
            )}
        </div>
    );
}
