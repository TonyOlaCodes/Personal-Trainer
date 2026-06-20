export type MetricKey = "sleep" | "diet" | "energy";
export type MetricTone = "bad" | "warn" | "neutral" | "good" | "great";

export const SLEEP_VALUE_LABELS = ["Poor", "Fair", "Okay", "Good", "Great"] as const;
export const DIET_VALUE_LABELS = ["Off track", "Inconsistent", "Average", "On point", "Locked in"] as const;
export const ENERGY_VALUE_LABELS = ["Depleted", "Low", "Fair", "Strong", "Peak"] as const;

const SLEEP_MESSAGES: Record<number, string> = {
    1: "Sleep was severely lacking. Recovery, mood, and training quality will all take a hit until this improves.",
    2: "Sleep was below par. A fixed bedtime and less screen time before bed could help next week.",
    3: "Sleep was middling—not wrecking you, but not giving you a real recovery edge either.",
    4: "Solid sleep this week. Your body had enough downtime to repair and adapt from training.",
    5: "Excellent sleep. You're stacking recovery on top of your work—that's how progress compounds.",
};

const DIET_MESSAGES: Record<number, string> = {
    1: "Nutrition was off track. It's very hard to out-train a poor diet—start with protein at each meal.",
    2: "Diet was inconsistent. Pick two meals you can nail every day and build from there.",
    3: "Diet was average—not sabotaging you, but tightening up portions or protein would help.",
    4: "Good nutritional discipline. You're fueling sessions and supporting recovery well.",
    5: "Diet locked in. Consistent fueling is one of the biggest levers for body comp and performance.",
};

const ENERGY_MESSAGES: Record<number, string> = {
    1: "Energy was depleted all week. Don't add more intensity—fix sleep, food, and stress first.",
    2: "Energy ran low. Scale training slightly and protect recovery until basics improve.",
    3: "Energy was fair—enough to get work done, but you weren't firing on all cylinders.",
    4: "Strong energy levels. You showed up ready to train and push sessions effectively.",
    5: "Peak energy. This is the window for your best sessions—use it while respecting recovery.",
};

export function getMetricTone(value: number): MetricTone {
    if (value <= 1) return "bad";
    if (value === 2) return "warn";
    if (value === 3) return "neutral";
    if (value === 4) return "good";
    return "great";
}

export const METRIC_TONE_CLASSES: Record<MetricTone, string> = {
    bad: "text-danger bg-danger/10 border-danger/20",
    warn: "text-warning bg-warning/10 border-warning/20",
    neutral: "text-fg-muted bg-surface-muted border-surface-border",
    good: "text-success bg-success/10 border-success/20",
    great: "text-success bg-success/10 border-success/20 shadow-glow-success-sm",
};

export interface MetricInsight {
    metric: MetricKey;
    label: string;
    value: number;
    valueLabel: string;
    message: string;
    tone: MetricTone;
}

export interface PerformanceFeedback {
    insights: MetricInsight[];
    overall: { message: string; tone: MetricTone } | null;
}

function insight(
    metric: MetricKey,
    label: string,
    value: number,
    valueLabels: readonly string[],
    messages: Record<number, string>
): MetricInsight {
    return {
        metric,
        label,
        value,
        valueLabel: valueLabels[value - 1] ?? `${value}/5`,
        message: messages[value] ?? "",
        tone: getMetricTone(value),
    };
}

function average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getOverallMessage(sleep: number, diet: number, energy: number, sleepHidden: boolean): { message: string; tone: MetricTone } | null {
    const scores = [
        !sleepHidden && sleep > 0 ? sleep : null,
        diet > 0 ? diet : null,
        energy > 0 ? energy : null,
    ].filter((v): v is number => v !== null);

    if (scores.length === 0) return null;

    const avg = average(scores)!;
    const hasSleep = !sleepHidden && sleep > 0;
    const hasDiet = diet > 0;
    const hasEnergy = energy > 0;
    const allThree = hasSleep && hasDiet && hasEnergy;

    if (allThree && sleep >= 4 && diet >= 4 && energy >= 4) {
        return {
            message: "Outstanding week. Sleep, diet, and energy are all aligned—this is the recipe for real progress. Stay consistent.",
            tone: "great",
        };
    }

    if (allThree && sleep <= 2 && energy <= 2) {
        return {
            message: "Recovery crisis. Poor sleep and low energy together mean your body is underfed or overstressed. Pull back intensity and fix the basics.",
            tone: "bad",
        };
    }

    if (hasDiet && hasEnergy && diet <= 2 && energy >= 4) {
        return {
            message: "Running hot on empty calories. High energy despite poor diet usually doesn't last—fuel properly before you burn out.",
            tone: "warn",
        };
    }

    if (hasSleep && hasEnergy && sleep <= 2 && energy >= 4) {
        return {
            message: "Caffeine and willpower aren't a long-term plan. Strong energy on poor sleep is a warning sign—prioritize rest before you crash.",
            tone: "warn",
        };
    }

    if (hasSleep && hasDiet && sleep >= 4 && diet <= 2) {
        return {
            message: "Well rested but under-fueled. Sleep is doing its job—match it with better nutrition to unlock the gains.",
            tone: "warn",
        };
    }

    if (hasDiet && hasEnergy && diet >= 4 && energy <= 2) {
        return {
            message: "Eating well but still flat. Check sleep, hydration, and training load—nutrition alone isn't fixing the fatigue.",
            tone: "warn",
        };
    }

    if (avg >= 4.5) {
        return {
            message: "Excellent overall. Your inputs this week strongly support training and recovery. Keep this rhythm going.",
            tone: "great",
        };
    }

    if (avg >= 3.5) {
        return {
            message: "Solid week. Most areas are in a good place—small tweaks to your weakest metric will move the needle.",
            tone: "good",
        };
    }

    if (avg >= 2.5) {
        return {
            message: "Mixed bag. You're getting some things right, but one or two areas are holding you back. Focus on the lowest score first.",
            tone: "neutral",
        };
    }

    if (avg >= 1.5) {
        return {
            message: "Rough week across the board. Don't chase PRs—stabilize sleep, food, and daily energy before ramping training back up.",
            tone: "warn",
        };
    }

    return {
        message: "Critical week. Multiple fundamentals were off. Treat this as a reset week: sleep, eat, move lightly, and rebuild.",
        tone: "bad",
    };
}

export function getPerformanceMetricsFeedback(opts: {
    sleep: number;
    diet: number;
    energy: number;
    sleepHidden?: boolean;
}): PerformanceFeedback {
    const { sleep, diet, energy, sleepHidden = false } = opts;
    const insights: MetricInsight[] = [];

    if (!sleepHidden && sleep > 0) {
        insights.push(insight("sleep", "Sleep", sleep, SLEEP_VALUE_LABELS, SLEEP_MESSAGES));
    }
    if (diet > 0) {
        insights.push(insight("diet", "Diet", diet, DIET_VALUE_LABELS, DIET_MESSAGES));
    }
    if (energy > 0) {
        insights.push(insight("energy", "Energy", energy, ENERGY_VALUE_LABELS, ENERGY_MESSAGES));
    }

    return {
        insights,
        overall: getOverallMessage(sleep, diet, energy, sleepHidden),
    };
}
