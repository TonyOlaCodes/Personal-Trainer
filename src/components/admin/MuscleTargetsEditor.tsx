"use client";

import { ALL_MUSCLE_REGIONS, MUSCLE_REGION_LABELS } from "@/lib/muscleRegions";
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

type LevelOrOff = MuscleContributionLevel | "off";

interface Props {
    value: MuscleTargetEntry[];
    onChange: (next: MuscleTargetEntry[]) => void;
    /** Used by "Fill from category" defaults. */
    exerciseName?: string;
    muscleGroup?: string | null;
    className?: string;
}

function levelForRegion(
    targets: MuscleTargetEntry[],
    region: (typeof ALL_MUSCLE_REGIONS)[number]
): LevelOrOff {
    return targets.find((t) => t.region === region)?.level ?? "off";
}

export function MuscleTargetsEditor({
    value,
    onChange,
    exerciseName,
    muscleGroup,
    className,
}: Props) {
    const targets = normalizeMuscleTargets(value);

    const setRegionLevel = (region: (typeof ALL_MUSCLE_REGIONS)[number], level: LevelOrOff) => {
        const next = targets.filter((t) => t.region !== region);
        if (level !== "off") {
            next.push({ region, level });
        }
        onChange(normalizeMuscleTargets(next));
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
                        Controls how this exercise lights up the muscle map (primary / secondary / minor).
                    </p>
                </div>
                <button type="button" onClick={fillFromCategory} className="btn-secondary btn-sm shrink-0">
                    Fill from category
                </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
                {ALL_MUSCLE_REGIONS.map((region) => {
                    const level = levelForRegion(targets, region);
                    return (
                        <label key={region} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-elevated/40 px-3 py-2">
                            <span className="text-xs font-semibold text-fg truncate">
                                {MUSCLE_REGION_LABELS[region]}
                            </span>
                            <select
                                className="input input-sm w-[7.5rem] shrink-0"
                                value={level}
                                onChange={(e) => setRegionLevel(region, e.target.value as LevelOrOff)}
                            >
                                <option value="off">Off</option>
                                {MUSCLE_CONTRIBUTION_LEVELS.map((l) => (
                                    <option key={l} value={l}>
                                        {MUSCLE_CONTRIBUTION_LABELS[l]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
