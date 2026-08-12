export type OverviewTier = "bad" | "decent" | "good";
export type OverviewTone = "bad" | "warn" | "neutral" | "good" | "great";

export interface CheckInOverviewSummary {
    headline: string;
    progress: string[];
    attention: string[];
    nextSteps: string[];
    unassessed: string[];
    tone: OverviewTone;
}

type MetricDimension = "sleep" | "energy" | "stress" | "training";

const PROGRESS_COPY: Record<MetricDimension, Record<OverviewTier, string | null>> = {
    sleep: {
        bad: null,
        decent: "Sleep was fair this week.",
        good: "Sleep looked solid this week.",
    },
    energy: {
        bad: null,
        decent: "Energy was steady across the week.",
        good: "Energy levels looked strong this week.",
    },
    stress: {
        bad: null,
        decent: "Stress stayed manageable this week.",
        good: "Stress stayed relatively low this week.",
    },
    training: {
        bad: null,
        decent: "Training involvement was moderate this week.",
        good: "Training effort looked strong this week.",
    },
};

const ATTENTION_COPY: Record<MetricDimension, Record<OverviewTier, string | null>> = {
    sleep: {
        bad: "Sleep quality was low this week.",
        decent: null,
        good: null,
    },
    energy: {
        bad: "Energy ran low this week.",
        decent: null,
        good: null,
    },
    stress: {
        bad: "Stress was elevated this week.",
        decent: null,
        good: null,
    },
    training: {
        bad: "Training output was limited this week.",
        decent: null,
        good: null,
    },
};

const NEXT_STEP_COPY: Record<MetricDimension, Record<OverviewTier, string>> = {
    sleep: {
        bad: "Focus on recovery habits you can keep consistent, and raise sleep with your coach if it keeps slipping.",
        decent: "Keep recovery steady and mention any sleep changes to your coach if they continue.",
        good: "Keep your current recovery rhythm going.",
    },
    energy: {
        bad: "Look for patterns affecting energy across the week and discuss them with your coach if needed.",
        decent: "Keep routines steady and flag any energy dips to your coach.",
        good: "Maintain the habits that are supporting your energy.",
    },
    stress: {
        bad: "Keep training load realistic while stress is high, and talk through concerns with your coach.",
        decent: "Stay aware of stress through the week so it does not build unnoticed.",
        good: "Keep doing what is helping you manage stress well.",
    },
    training: {
        bad: "Aim for better consistency with scheduled workouts and rebuild one session at a time.",
        decent: "Keep building consistency with your planned training.",
        good: "Maintain your current training rhythm and progress gradually.",
    },
};

function scoreValue(value: number, inverse = false): number {
    return inverse ? 6 - value : value;
}

export function ratingToTier(value: number, inverse = false): OverviewTier | null {
    if (value <= 0) return null;
    const score = scoreValue(value, inverse);
    if (score <= 2) return "bad";
    if (score === 3) return "decent";
    return "good";
}

function overallTone(progressCount: number, attentionCount: number): OverviewTone {
    if (attentionCount >= 2) return "bad";
    if (attentionCount === 1 && progressCount === 0) return "warn";
    if (progressCount >= 2 && attentionCount === 0) return "great";
    if (progressCount >= 1 && attentionCount === 0) return "good";
    return "neutral";
}

function buildHeadline(progressCount: number, attentionCount: number): string {
    if (progressCount >= 2 && attentionCount === 0) {
        return "A strong week across the metrics you logged.";
    }
    if (attentionCount >= 2) {
        return "A few areas need attention based on what you logged.";
    }
    if (progressCount >= 1 && attentionCount >= 1) {
        return "A mixed week — some positives and a few areas to watch.";
    }
    if (attentionCount === 1) {
        return "Mostly steady, with one area that stood out.";
    }
    return "A steady week based on the metrics you logged.";
}

export function getCheckInOverviewSummary(opts: {
    sleep: number;
    diet?: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden?: boolean;
}): CheckInOverviewSummary | null {
    const { sleep, energy, stress, training, sleepHidden = false } = opts;

    const logged: Array<{ dimension: MetricDimension; tier: OverviewTier; inverse: boolean }> = [];
    const unassessed: string[] = [];

    if (!sleepHidden) {
        if (sleep > 0) {
            const tier = ratingToTier(sleep);
            if (tier) logged.push({ dimension: "sleep", tier, inverse: false });
        } else {
            unassessed.push("Sleep");
        }
    }

    if (energy > 0) {
        const tier = ratingToTier(energy);
        if (tier) logged.push({ dimension: "energy", tier, inverse: false });
    } else {
        unassessed.push("Energy");
    }

    if (stress > 0) {
        const tier = ratingToTier(stress, true);
        if (tier) logged.push({ dimension: "stress", tier, inverse: true });
    } else {
        unassessed.push("Stress");
    }

    if (training > 0) {
        const tier = ratingToTier(training);
        if (tier) logged.push({ dimension: "training", tier, inverse: false });
    } else {
        unassessed.push("Training");
    }

    if (logged.length === 0) return null;

    const progress: string[] = [];
    const attention: string[] = [];

    for (const item of logged) {
        const progressLine = PROGRESS_COPY[item.dimension][item.tier];
        const attentionLine = ATTENTION_COPY[item.dimension][item.tier];
        if (progressLine) progress.push(progressLine);
        if (attentionLine) attention.push(attentionLine);
    }

    const rank: Record<OverviewTier, number> = { bad: 0, decent: 1, good: 2 };
    const focus = logged
        .slice()
        .sort((a, b) => rank[a.tier] - rank[b.tier])[0];

    const nextSteps = [NEXT_STEP_COPY[focus.dimension][focus.tier]];
    if (unassessed.length > 0) {
        nextSteps.push("Log any missing metrics next time for a fuller picture.");
    }
    nextSteps.push("Share anything you are unsure about with your coach.");

    return {
        headline: buildHeadline(progress.length, attention.length),
        progress,
        attention,
        nextSteps,
        unassessed,
        tone: overallTone(progress.length, attention.length),
    };
}
