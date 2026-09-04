/**
 * Centrally configurable muscle contribution weights and heat bands.
 * Used by workout visuals, admin dictionary, and future volume analytics.
 */

export const MUSCLE_CONTRIBUTION_LEVELS = ["primary", "secondary", "minor"] as const;
export type MuscleContributionLevel = (typeof MUSCLE_CONTRIBUTION_LEVELS)[number];

/** Numeric weights — adjust here to tune the whole app. */
export const MUSCLE_CONTRIBUTION_WEIGHTS: Record<MuscleContributionLevel, number> = {
    primary: 1.0,
    secondary: 0.5,
    minor: 0.2,
};

export const MUSCLE_CONTRIBUTION_LABELS: Record<MuscleContributionLevel, string> = {
    primary: "Primary",
    secondary: "Secondary",
    minor: "Minor",
};

/**
 * Absolute score thresholds (after summing weight × sets across the workout).
 * Relative ratio vs max is also considered — see heatFromContribution.
 */
export const MUSCLE_HEAT_THRESHOLDS = {
    /** pale yellow */
    veryLow: 0.15,
    /** yellow */
    low: 0.8,
    /** orange */
    moderate: 2.0,
    /** red */
    high: 4.0,
    /** dark red — genuine heavy targeting */
    veryHigh: 6.5,
} as const;

export type MuscleHeatLevel = "none" | "veryLow" | "low" | "moderate" | "high" | "veryHigh";

export function heatFromContribution(score: number, maxScore: number): MuscleHeatLevel {
    if (score <= 0) return "none";
    const ratio = maxScore > 0 ? score / maxScore : 0;
    const t = MUSCLE_HEAT_THRESHOLDS;

    if (score >= t.veryHigh || (ratio >= 0.9 && score >= t.high)) return "veryHigh";
    if (score >= t.high || (ratio >= 0.7 && score >= t.moderate)) return "high";
    if (score >= t.moderate || (ratio >= 0.45 && score >= t.low)) return "moderate";
    if (score >= t.low || (ratio >= 0.25 && score >= t.veryLow)) return "low";
    return "veryLow";
}

/** Fill colours: pale yellow → yellow → orange → red → dark red. */
export function muscleHeatFill(level: MuscleHeatLevel | undefined): string {
    switch (level) {
        case "veryHigh":
            return "#991b1b";
        case "high":
            return "#ef4444";
        case "moderate":
            return "#f59e0b";
        case "low":
            return "#eab308";
        case "veryLow":
            return "#fde047";
        default:
            return "#64748b";
    }
}

export function muscleHeatStroke(level: MuscleHeatLevel | undefined): string {
    switch (level) {
        case "veryHigh":
            return "#fca5a5";
        case "high":
            return "#fca5a5";
        case "moderate":
            return "#fcd34d";
        case "low":
            return "#fde047";
        case "veryLow":
            return "#fef9c3";
        default:
            return "#475569";
    }
}

export function muscleHeatOpacity(level: MuscleHeatLevel | undefined): number {
    switch (level) {
        case "veryHigh":
            return 0.95;
        case "high":
            return 0.88;
        case "moderate":
            return 0.78;
        case "low":
            return 0.68;
        case "veryLow":
            return 0.55;
        default:
            return 0.35;
    }
}
