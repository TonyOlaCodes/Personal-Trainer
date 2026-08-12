"use client";

import { cn } from "@/lib/utils";
import {
    MUSCLE_REGION_LABELS,
    hasMuscleData,
    type MuscleRegion,
    type WorkoutMuscleBreakdown,
} from "@/lib/exerciseMuscles";

/**
 * Front and back body silhouettes with the trained muscles highlighted.
 * Regions come from exercise metadata only — an unmapped exercise is reported as
 * "no muscle data" rather than shaded.
 */

type BodyView = "front" | "back";

/** Which silhouette each region is drawn on. */
const REGION_VIEW: Record<MuscleRegion, BodyView[]> = {
    chest: ["front"],
    shoulders: ["front", "back"],
    biceps: ["front"],
    forearms: ["front"],
    core: ["front"],
    obliques: ["front"],
    quads: ["front"],
    traps: ["back"],
    upperBack: ["back"],
    lats: ["back"],
    lowerBack: ["back"],
    triceps: ["back"],
    glutes: ["back"],
    hamstrings: ["back"],
    calves: ["back"],
};

/** Simplified anatomy shapes on a 200×420 canvas, mirrored for left/right. */
const REGION_SHAPES: Record<MuscleRegion, string[]> = {
    chest: [
        "M100 108 q-22 -6 -34 4 q-6 16 2 28 q16 8 32 2 z",
        "M100 108 q22 -6 34 4 q6 16 -2 28 q-16 8 -32 2 z",
    ],
    shoulders: [
        "M66 100 q-16 2 -21 18 q-2 14 4 22 q12 -4 18 -16 q3 -12 -1 -24 z",
        "M134 100 q16 2 21 18 q2 14 -4 22 q-12 -4 -18 -16 q-3 -12 1 -24 z",
    ],
    biceps: [
        "M56 142 q-9 12 -8 30 q1 14 8 20 q9 -8 11 -24 q1 -16 -11 -26 z",
        "M144 142 q9 12 8 30 q-1 14 -8 20 q-9 -8 -11 -24 q-1 -16 11 -26 z",
    ],
    triceps: [
        "M54 140 q-11 14 -10 34 q1 14 9 20 q9 -10 10 -28 q1 -18 -9 -26 z",
        "M146 140 q11 14 10 34 q-1 14 -9 20 q-9 -10 -10 -28 q-1 -18 9 -26 z",
    ],
    forearms: [
        "M50 196 q-8 16 -6 36 q2 16 8 22 q8 -10 9 -30 q1 -20 -11 -28 z",
        "M150 196 q8 16 6 36 q-2 16 -8 22 q-8 -10 -9 -30 q-1 -20 11 -28 z",
    ],
    core: ["M100 146 q-18 0 -21 10 l0 52 q4 12 21 12 q17 0 21 -12 l0 -52 q-3 -10 -21 -10 z"],
    obliques: [
        "M76 152 q-10 6 -11 22 q-1 20 6 34 q8 -6 9 -24 q1 -20 -4 -32 z",
        "M124 152 q10 6 11 22 q1 20 -6 34 q-8 -6 -9 -24 q-1 -20 4 -32 z",
    ],
    traps: ["M100 84 q-26 4 -34 20 q16 8 34 8 q18 0 34 -8 q-8 -16 -34 -20 z"],
    upperBack: [
        "M100 112 q-26 -2 -32 12 q-2 18 6 28 q14 4 26 0 z",
        "M100 112 q26 -2 32 12 q2 18 -6 28 q-14 4 -26 0 z",
    ],
    lats: [
        "M68 130 q-8 22 -2 46 q6 14 16 18 q6 -22 6 -46 q0 -14 -20 -18 z",
        "M132 130 q8 22 2 46 q-6 14 -16 18 q-6 -22 -6 -46 q0 -14 20 -18 z",
    ],
    lowerBack: ["M100 186 q-16 0 -19 10 q-1 16 5 24 q14 4 28 0 q6 -8 5 -24 q-3 -10 -19 -10 z"],
    glutes: [
        "M100 220 q-22 0 -26 14 q-2 18 8 26 q12 4 18 -4 z",
        "M100 220 q22 0 26 14 q2 18 -8 26 q-12 4 -18 -4 z",
    ],
    quads: [
        "M84 226 q-12 22 -10 54 q2 24 10 34 q10 -12 12 -42 q2 -30 -12 -46 z",
        "M116 226 q12 22 10 54 q-2 24 -10 34 q-10 -12 -12 -42 q-2 -30 12 -46 z",
    ],
    hamstrings: [
        "M84 262 q-11 20 -9 48 q2 20 9 28 q9 -10 11 -36 q2 -26 -11 -40 z",
        "M116 262 q11 20 9 48 q-2 20 -9 28 q-9 -10 -11 -36 q-2 -26 11 -40 z",
    ],
    calves: [
        "M85 336 q-9 16 -8 40 q1 18 8 24 q8 -8 9 -30 q1 -22 -9 -34 z",
        "M115 336 q9 16 8 40 q-1 18 -8 24 q-8 -8 -9 -30 q-1 -22 9 -34 z",
    ],
};

const SILHOUETTE =
    "M100 22 a17 17 0 0 1 17 17 a17 17 0 0 1 -17 17 a17 17 0 0 1 -17 -17 a17 17 0 0 1 17 -17 z"
    + " M100 60 q26 2 38 18 q10 14 12 40 q3 26 8 44 q4 18 -2 24 q-8 2 -12 -10 q-3 22 -6 40"
    + " q-2 14 0 26 q3 40 1 74 q-1 32 -6 52 q-6 14 -16 12 q-8 -2 -9 -18 q-2 -30 -8 -60"
    + " q-6 30 -8 60 q-1 16 -9 18 q-10 2 -16 -12 q-5 -20 -6 -52 q-2 -34 1 -74 q2 -12 0 -26"
    + " q-3 -18 -6 -40 q-4 12 -12 10 q-6 -6 -2 -24 q5 -18 8 -44 q2 -26 12 -40 q12 -16 38 -18 z";

function BodyOutline({
    view,
    primary,
    secondary,
}: {
    view: BodyView;
    primary: Set<MuscleRegion>;
    secondary: Set<MuscleRegion>;
}) {
    const regions = (Object.keys(REGION_SHAPES) as MuscleRegion[]).filter((region) =>
        REGION_VIEW[region].includes(view)
    );

    return (
        <div className="flex flex-col items-center gap-1">
            <svg
                viewBox="0 0 200 420"
                className="w-full h-auto max-h-[220px]"
                role="img"
                aria-label={`${view === "front" ? "Front" : "Back"} view of muscles trained`}
            >
                <path
                    d={SILHOUETTE}
                    className="fill-surface-muted/40 stroke-surface-border"
                    strokeWidth={1.5}
                />
                {regions.map((region) => {
                    const isPrimary = primary.has(region);
                    const isSecondary = !isPrimary && secondary.has(region);
                    if (!isPrimary && !isSecondary) return null;

                    return REGION_SHAPES[region].map((shape, index) => (
                        <path
                            key={`${region}-${index}`}
                            d={shape}
                            className={cn(
                                isPrimary
                                    ? "fill-brand-500/85 stroke-brand-300/70"
                                    : "fill-brand-500/28 stroke-brand-500/35"
                            )}
                            strokeWidth={0.8}
                        />
                    ));
                })}
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                {view === "front" ? "Front" : "Back"}
            </span>
        </div>
    );
}

interface Props {
    breakdown: WorkoutMuscleBreakdown;
    className?: string;
    /** Compact rendering for the active workout screen. */
    compact?: boolean;
}

export function MuscleMap({ breakdown, className, compact = false }: Props) {
    const primary = new Set(breakdown.primary);
    const secondary = new Set(breakdown.secondary);

    if (!hasMuscleData(breakdown)) {
        return (
            <div className={cn("card p-4", className)}>
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                    Muscles trained
                </p>
                <p className="text-xs text-fg-muted mt-1.5">
                    {breakdown.activityGroups.length > 0
                        ? `${breakdown.activityGroups.join(", ")} session — no muscle mapping recorded.`
                        : "No muscle data recorded for these exercises."}
                </p>
            </div>
        );
    }

    return (
        <div className={cn("card p-4 space-y-3", className)}>
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                    Muscles trained
                </p>
                {breakdown.unknownExerciseCount > 0 && (
                    <span className="text-[9px] font-semibold text-fg-subtle">
                        {breakdown.unknownExerciseCount} without muscle data
                    </span>
                )}
            </div>

            <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 sm:gap-5")}>
                <BodyOutline view="front" primary={primary} secondary={secondary} />
                <BodyOutline view="back" primary={primary} secondary={secondary} />
            </div>

            <div className="space-y-2">
                <MuscleLegendRow
                    label="Primary"
                    regions={breakdown.primary}
                    dotClass="bg-brand-500"
                    textClass="text-fg"
                />
                {breakdown.secondary.length > 0 && (
                    <MuscleLegendRow
                        label="Secondary"
                        regions={breakdown.secondary}
                        dotClass="bg-brand-500/35"
                        textClass="text-fg-muted"
                    />
                )}
            </div>
        </div>
    );
}

function MuscleLegendRow({
    label,
    regions,
    dotClass,
    textClass,
}: {
    label: string;
    regions: MuscleRegion[];
    dotClass: string;
    textClass: string;
}) {
    if (regions.length === 0) return null;

    return (
        <div className="flex items-start gap-2">
            <span className={cn("w-2 h-2 rounded-full mt-1 shrink-0", dotClass)} />
            <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle mr-1.5">
                    {label}
                </span>
                <span className={cn("text-[11px] font-semibold", textClass)}>
                    {regions.map((region) => MUSCLE_REGION_LABELS[region]).join(" · ")}
                </span>
            </div>
        </div>
    );
}

/** Single-line muscle summary for tight spaces such as the active workout header. */
export function MuscleChips({
    breakdown,
    className,
}: {
    breakdown: WorkoutMuscleBreakdown;
    className?: string;
}) {
    if (!hasMuscleData(breakdown)) {
        if (breakdown.activityGroups.length === 0) return null;
        return (
            <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
                {breakdown.activityGroups.map((group) => (
                    <span
                        key={group}
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-muted/50 text-fg-subtle border border-surface-border/60"
                    >
                        {group}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
            {breakdown.primary.map((region) => (
                <span
                    key={region}
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 border border-brand-500/25"
                >
                    {MUSCLE_REGION_LABELS[region]}
                </span>
            ))}
            {breakdown.secondary.map((region) => (
                <span
                    key={region}
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-muted/50 text-fg-subtle border border-surface-border/60"
                >
                    {MUSCLE_REGION_LABELS[region]}
                </span>
            ))}
        </div>
    );
}
