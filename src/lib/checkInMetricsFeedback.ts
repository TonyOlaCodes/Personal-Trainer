import { getCheckInOverviewSummary } from "@/lib/checkInOverviewSummaries";

export type MetricKey = "sleep" | "diet" | "energy" | "stress" | "training";
export type MetricTone = "bad" | "warn" | "neutral" | "good" | "great";

export const SLEEP_VALUE_LABELS = ["Poor", "Fair", "Okay", "Good", "Great"] as const;
export const DIET_VALUE_LABELS = ["Off track", "Inconsistent", "Average", "On point", "Locked in"] as const;
export const ENERGY_VALUE_LABELS = ["Depleted", "Low", "Fair", "Strong", "Peak"] as const;
export const STRESS_VALUE_LABELS = ["None", "Little", "Some", "High", "Max"] as const;
export const TRAINING_VALUE_LABELS = ["Skipped", "Light", "Solid", "Hard", "Beast"] as const;

export function getMetricTone(value: number, inverse = false): MetricTone {
    const score = inverse ? 6 - value : value;
    if (score <= 1) return "bad";
    if (score === 2) return "warn";
    if (score === 3) return "neutral";
    if (score === 4) return "good";
    return "great";
}

export const METRIC_TONE_CLASSES: Record<MetricTone, string> = {
    bad: "text-danger bg-danger/10 border-danger/20",
    warn: "text-warning bg-warning/10 border-warning/20",
    neutral: "text-fg-muted bg-surface-muted border-surface-border",
    good: "text-success bg-success/10 border-success/20",
    great: "text-success bg-success/10 border-success/20 shadow-glow-success-sm",
};

export interface PerformanceFeedback {
    overall: { message: string; tone: MetricTone } | null;
}

export function getPerformanceMetricsFeedback(opts: {
    sleep: number;
    diet: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden?: boolean;
}): PerformanceFeedback {
    const summary = getCheckInOverviewSummary(opts);
    if (!summary) return { overall: null };

    return {
        overall: {
            message: summary.message,
            tone: summary.tone,
        },
    };
}
