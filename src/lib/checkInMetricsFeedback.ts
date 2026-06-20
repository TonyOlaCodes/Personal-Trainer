export type MetricKey = "sleep" | "diet" | "energy" | "stress" | "training";
export type MetricTone = "bad" | "warn" | "neutral" | "good" | "great";

export const SLEEP_VALUE_LABELS = ["Poor", "Fair", "Okay", "Good", "Great"] as const;
export const DIET_VALUE_LABELS = ["Off track", "Inconsistent", "Average", "On point", "Locked in"] as const;
export const ENERGY_VALUE_LABELS = ["Depleted", "Low", "Fair", "Strong", "Peak"] as const;
export const STRESS_VALUE_LABELS = ["None", "Little", "Some", "High", "Max"] as const;
export const TRAINING_VALUE_LABELS = ["Skipped", "Light", "Solid", "Hard", "Beast"] as const;

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

const STRESS_MESSAGES: Record<number, string> = {
    1: "Stress was minimal. Your nervous system had room to recover—great for performance and consistency.",
    2: "Low stress week. Life stayed manageable and that supports better training quality.",
    3: "Moderate stress. Nothing critical, but keep an eye on it so it doesn't spill into sleep or appetite.",
    4: "Stress ran high. Recovery will suffer if this continues—protect sleep and deload if needed.",
    5: "Max stress. Your body is in fight-or-flight mode. Prioritize rest, not more volume.",
};

const TRAINING_MESSAGES: Record<number, string> = {
    1: "Training was mostly skipped. Consistency beats perfection—aim to show up even for a light session.",
    2: "Light training week. Fine for a deload, but progress needs more regular stimulus over time.",
    3: "Solid training week. You put in respectable work without overcooking it.",
    4: "Hard training week. Good effort—make sure recovery matches the output.",
    5: "Beast mode. Huge training load—watch sleep, food, and stress so you don't burn out.",
};

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
    messages: Record<number, string>,
    inverse = false
): MetricInsight {
    return {
        metric,
        label,
        value,
        valueLabel: valueLabels[value - 1] ?? `${value}/5`,
        message: messages[value] ?? "",
        tone: getMetricTone(value, inverse),
    };
}

function average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function scoredValue(metric: MetricKey, value: number): number {
    if (metric === "stress") return 6 - value;
    return value;
}

function getOverallMessage(opts: {
    sleep: number;
    diet: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden: boolean;
}): { message: string; tone: MetricTone } | null {
    const { sleep, diet, energy, stress, training, sleepHidden } = opts;

    const scores = [
        !sleepHidden && sleep > 0 ? scoredValue("sleep", sleep) : null,
        diet > 0 ? scoredValue("diet", diet) : null,
        energy > 0 ? scoredValue("energy", energy) : null,
        stress > 0 ? scoredValue("stress", stress) : null,
        training > 0 ? scoredValue("training", training) : null,
    ].filter((v): v is number => v !== null);

    if (scores.length === 0) return null;

    const avg = average(scores)!;
    const drive = (energy > 0 ? energy : 0) + (training > 0 ? training : 0);
    const recovery = (sleepHidden || sleep <= 0 ? 0 : sleep) - (stress > 0 ? stress : 0);

    if (sleep > 0 && stress > 0 && training > 0 && sleep <= 2 && stress >= 4 && training >= 4) {
        return {
            message: "Redlining. You're training hard under high stress with poor sleep—injury and burnout risk are real. Deload or cut volume now.",
            tone: "bad",
        };
    }

    if (diet > 0 && energy > 0 && diet <= 2 && energy >= 4 && training >= 4) {
        return {
            message: "High output, poor fuel. You're pushing sessions hard without the nutrition to back it up. Fix food before adding more load.",
            tone: "warn",
        };
    }

    if (!sleepHidden && sleep >= 4 && diet >= 4 && energy >= 4 && stress > 0 && stress <= 2) {
        return {
            message: "Outstanding week. Sleep, diet, energy, and stress are all working in your favour—this is how sustainable progress looks.",
            tone: "great",
        };
    }

    if (drive >= 8 && recovery <= -1) {
        return {
            message: "Overreaching. High training and energy with weak recovery. You're borrowing from next week—pull back before you crash.",
            tone: "warn",
        };
    }

    if (drive <= 4 && recovery >= 2) {
        return {
            message: "Under-stimulated. Recovery looks fine but output was low. You have capacity to train harder if motivation and diet are in place.",
            tone: "neutral",
        };
    }

    if (avg >= 4.5) {
        return {
            message: "Excellent overall. Your weekly inputs strongly support training and recovery. Keep this rhythm going.",
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
            message: "Mixed week. Some fundamentals are working, but weak spots are holding you back. Tackle your lowest score first.",
            tone: "neutral",
        };
    }

    if (avg >= 1.5) {
        return {
            message: "Rough week. Don't chase PRs—stabilize sleep, nutrition, stress, and daily energy before ramping training back up.",
            tone: "warn",
        };
    }

    return {
        message: "Critical week. Multiple fundamentals were off. Treat this as a reset: sleep, eat, manage stress, move lightly, rebuild.",
        tone: "bad",
    };
}

export function getPerformanceMetricsFeedback(opts: {
    sleep: number;
    diet: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden?: boolean;
}): PerformanceFeedback {
    const { sleep, diet, energy, stress, training, sleepHidden = false } = opts;
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
    if (stress > 0) {
        insights.push(insight("stress", "Stress", stress, STRESS_VALUE_LABELS, STRESS_MESSAGES, true));
    }
    if (training > 0) {
        insights.push(insight("training", "Training", training, TRAINING_VALUE_LABELS, TRAINING_MESSAGES));
    }

    return {
        insights,
        overall: getOverallMessage({ sleep, diet, energy, stress, training, sleepHidden }),
    };
}
