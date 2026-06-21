export type OverviewTier = "bad" | "decent" | "good";
export type OverviewTone = "bad" | "warn" | "neutral" | "good" | "great";

/** Four overview axes (81 combos): recovery, energy, stress, load — load links stress + training. */
export type OverviewKey = `${OverviewTier}${OverviewTier}${OverviewTier}${OverviewTier}`;

const TIER_ORDER: OverviewTier[] = ["bad", "decent", "good"];

const RECOVERY: Record<OverviewTier, string> = {
    bad: "Recovery was weak",
    decent: "Recovery was okay",
    good: "Recovery was solid",
};

const ENERGY: Record<OverviewTier, string> = {
    bad: "energy ran low",
    decent: "energy was fair",
    good: "energy was strong",
};

const STRESS: Record<OverviewTier, string> = {
    bad: "stress stayed high",
    decent: "stress was manageable",
    good: "stress stayed low",
};

const LOAD: Record<OverviewTier, string> = {
    bad: "training output was low",
    decent: "training was moderate",
    good: "training output was strong",
};

const FOCUS: Record<OverviewTier, Record<"recovery" | "energy" | "stress" | "load", string>> = {
    bad: {
        recovery: "Protect sleep and hit protein at two meals daily.",
        energy: "Eat enough and sleep earlier before adding training volume.",
        stress: "Cut optional stressors and keep sessions lighter next week.",
        load: "Show up for short sessions — consistency beats perfection.",
    },
    decent: {
        recovery: "Tighten bedtime by 30 minutes and keep meals regular.",
        energy: "Add a snack on training days to avoid mid-week dips.",
        stress: "Keep stress from spilling into sleep — one unwind habit helps.",
        load: "Add one harder set or an extra session if recovery holds up.",
    },
    good: {
        recovery: "Keep the same sleep and meal rhythm.",
        energy: "Ride the momentum — don't skip meals on busy days.",
        stress: "Stay proactive so stress doesn't creep up mid-week.",
        load: "Progress gradually — don't jump volume just because you feel good.",
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

/** Metrics 1+2 (sleep & diet) share one recovery tier — use the weaker score. */
export function recoveryTier(sleep: number, diet: number, sleepHidden: boolean): OverviewTier {
    const tiers: OverviewTier[] = [];
    if (!sleepHidden && sleep > 0) {
        const tier = ratingToTier(sleep);
        if (tier) tiers.push(tier);
    }
    if (diet > 0) {
        const tier = ratingToTier(diet);
        if (tier) tiers.push(tier);
    }
    if (tiers.length === 0) return "decent";
    if (tiers.includes("bad")) return "bad";
    if (tiers.every((t) => t === "good")) return "good";
    return "decent";
}

/** Metrics 4+5 (stress & training) share one load tier — blend inverted stress with training. */
export function loadTier(stress: number, training: number): OverviewTier {
    const scores: number[] = [];
    if (stress > 0) scores.push(scoreValue(stress, true));
    if (training > 0) scores.push(scoreValue(training, false));
    if (scores.length === 0) return "decent";
    const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
    if (avg <= 2) return "bad";
    if (avg <= 3.5) return "decent";
    return "good";
}

export function buildOverviewKey(opts: {
    sleep: number;
    diet: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden?: boolean;
}): OverviewKey | null {
    const { sleep, diet, energy, stress, training, sleepHidden = false } = opts;
    const hasAny = (!sleepHidden && sleep > 0) || diet > 0 || energy > 0 || stress > 0 || training > 0;
    if (!hasAny) return null;

    const r = recoveryTier(sleep, diet, sleepHidden);
    const e = energy > 0 ? ratingToTier(energy) ?? "decent" : "decent";
    const s = stress > 0 ? ratingToTier(stress, true) ?? "decent" : "decent";
    const l = loadTier(stress, training);

    return `${r}${e}${s}${l}`;
}

function overallTone(key: OverviewKey): OverviewTone {
    const tiers = key.split("") as OverviewTier[];
    const badCount = tiers.filter((t) => t === "bad").length;
    const goodCount = tiers.filter((t) => t === "good").length;
    if (badCount >= 2) return "bad";
    if (badCount === 1 && goodCount === 0) return "warn";
    if (goodCount >= 3 && badCount === 0) return "great";
    if (goodCount >= 2 && badCount === 0) return "good";
    return "neutral";
}

function buildMessage(key: OverviewKey): string {
    const [r, e, s, l] = key.split("") as [OverviewTier, OverviewTier, OverviewTier, OverviewTier];
    const headline =
        r === "good" && e === "good" && s === "good" && l === "good"
            ? "Excellent week overall."
            : r === "bad" && e === "bad" && s === "bad" && l === "bad"
                ? "Rough week across the board."
                : r === "good" && l === "good" && (s === "bad" || e === "bad")
                    ? "Good training week, but recovery or stress needs attention."
                    : l === "bad" && r === "good"
                        ? "Recovery was there, but training output lagged."
                        : r === "bad" && l === "good"
                            ? "You pushed training despite weak recovery — watch for a crash."
                            : s === "bad" && l === "good"
                                ? "High stress but you still trained — prioritize rest next week."
                                : "Mixed week — some areas strong, others need work.";

    const body = `${RECOVERY[r]}, ${ENERGY[e]}, ${STRESS[s]}, and ${LOAD[l]}.`;
    const tierByDimension: Record<"recovery" | "energy" | "stress" | "load", OverviewTier> = {
        recovery: r,
        energy: e,
        stress: s,
        load: l,
    };
    const rank: Record<OverviewTier, number> = { bad: 0, decent: 1, good: 2 };
    const focusKey = ([ "recovery", "energy", "stress", "load" ] as const)
        .slice()
        .sort((a, b) => rank[tierByDimension[a]] - rank[tierByDimension[b]])[0];

    return `${headline} ${body} Next week: ${FOCUS[tierByDimension[focusKey]][focusKey]}`;
}

const SUMMARY_CACHE = new Map<OverviewKey, { message: string; tone: OverviewTone }>();

export function getCheckInOverviewSummary(opts: {
    sleep: number;
    diet: number;
    energy: number;
    stress: number;
    training: number;
    sleepHidden?: boolean;
}): { message: string; tone: OverviewTone } | null {
    const key = buildOverviewKey(opts);
    if (!key) return null;

    const cached = SUMMARY_CACHE.get(key);
    if (cached) return cached;

    const summary = { message: buildMessage(key), tone: overallTone(key) };
    SUMMARY_CACHE.set(key, summary);
    return summary;
}

/** Pre-warm all 81 combinations for consistent copy. */
export function warmCheckInOverviewSummaries() {
    for (const r of TIER_ORDER) {
        for (const e of TIER_ORDER) {
            for (const s of TIER_ORDER) {
                for (const l of TIER_ORDER) {
                    const key = `${r}${e}${s}${l}` as OverviewKey;
                    if (!SUMMARY_CACHE.has(key)) {
                        SUMMARY_CACHE.set(key, { message: buildMessage(key), tone: overallTone(key) });
                    }
                }
            }
        }
    }
}

warmCheckInOverviewSummaries();
