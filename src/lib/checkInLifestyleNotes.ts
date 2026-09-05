import {
    isCaloriesOnTarget,
    isSleepOnTarget,
    isStepsOnTarget,
    type LifestyleMetricKey,
    type LifestyleMetricSummary,
} from "@/lib/lifestylePeriodMetrics";

export const MIN_LIFESTYLE_ASSESSMENT_LOGGED_DAYS = 3;
export const MIN_LIFESTYLE_ASSESSMENT_LOGGING_RATE = 0.4;

export type LifestyleCheckInVerdict = "good" | "low" | "high" | "insufficient" | "no-target";

export function hasEnoughLifestyleAssessmentData(loggedDays: number, expectedDays: number): boolean {
    if (loggedDays < MIN_LIFESTYLE_ASSESSMENT_LOGGED_DAYS) return false;
    if (expectedDays <= 0) return false;
    if (loggedDays >= 5) return true;
    return loggedDays / expectedDays >= MIN_LIFESTYLE_ASSESSMENT_LOGGING_RATE;
}

function pickVariant(seed: string, options: string[]): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash + seed.charCodeAt(i) * (i + 1)) % 2147483647;
    }
    return options[Math.abs(hash) % options.length];
}

export function resolveLifestyleVerdict(
    key: LifestyleMetricKey,
    summary: LifestyleMetricSummary,
    enoughData: boolean
): LifestyleCheckInVerdict {
    if (!enoughData) return "insufficient";
    if (summary.target == null || summary.average == null) return "no-target";

    if (key === "calories") {
        if (isCaloriesOnTarget(summary.average, summary.target)) return "good";
        return summary.average < summary.target ? "low" : "high";
    }

    if (key === "steps") {
        if (isStepsOnTarget(summary.average, summary.target) || (summary.adherencePercent ?? 0) >= 70) {
            return "good";
        }
        return "low";
    }

    if (isSleepOnTarget(summary.average, summary.target)) return "good";
    return summary.average < summary.target ? "low" : "high";
}

export function buildLifestyleCheckInCopy(
    key: LifestyleMetricKey,
    summary: LifestyleMetricSummary,
    verdict: LifestyleCheckInVerdict
): { message: string; detail: string } {
    const seed = `${key}:${summary.average ?? "x"}:${summary.loggedDays}:${summary.expectedDays}`;
    const loggedLine = `${summary.loggedDays}/${summary.expectedDays} days logged`;

    if (verdict === "insufficient") {
        return {
            message: "Not enough data yet",
            detail: pickVariant(seed, [
                `Log a few more days so we can assess your ${key} consistency.`,
                "Not enough data yet. Log more consistently next check-in.",
                `Only ${loggedLine}. Log a few more days to get a reliable summary.`,
            ]),
        };
    }

    if (verdict === "no-target") {
        return {
            message: summary.average == null ? "No logs yet" : "No goal set",
            detail: summary.average == null
                ? "Nothing logged for this period yet."
                : "Values were logged, but no target is set yet.",
        };
    }

    if (key === "calories") {
        if (verdict === "good") {
            return {
                message: pickVariant(seed, ["On target", "Close to target", "Good consistency"]),
                detail: pickVariant(seed, [
                    "Good consistency. Calories were close to target most days.",
                    "You stayed close to target most days.",
                    "Strong week. Keep this level of consistency.",
                ]),
            };
        }
        if (verdict === "low") {
            return {
                message: "Below target",
                detail: pickVariant(seed, [
                    "Calories were under target most logged days. Try planning one extra meal or snack.",
                    "Intake sat below target on most logged days. Add a planned snack if that fits your goal.",
                ]),
            };
        }
        return {
            message: "Above target",
            detail: pickVariant(seed, [
                "Calories were above target most days. Tighten portions slightly and aim closer to your target.",
                "Most logged days sat above target. Small portion adjustments should bring you closer.",
            ]),
        };
    }

    if (key === "steps") {
        if (verdict === "good") {
            return {
                message: pickVariant(seed, ["On target", "Good consistency"]),
                detail: pickVariant(seed, [
                    "Good consistency this week.",
                    "You stayed close to your step goal most days.",
                    "Strong week. Keep this level of consistency.",
                ]),
            };
        }
        return {
            message: "Below target",
            detail: pickVariant(seed, [
                "Try adding a short walk after meals.",
                "You were below your step goal most days. Aim for one extra walk per day.",
                "Consistent logging, but steps were below target most days.",
            ]),
        };
    }

    if (verdict === "good") {
        return {
            message: pickVariant(seed, ["On target", "Good consistency"]),
            detail: pickVariant(seed, [
                "Sleep stayed close to target on logged days.",
                "Good consistency this week.",
                "You stayed close to target most days.",
            ]),
        };
    }
    if (verdict === "low") {
        return {
            message: "Below target",
            detail: pickVariant(seed, [
                "Sleep was below target this week. Try getting to bed a little earlier.",
                "Your sleep consistency needs work. A more regular bedtime may help.",
                "Try getting to bed earlier and keeping a more consistent bedtime.",
            ]),
        };
    }
    return {
        message: "Above the useful range",
        detail: "Average sleep sat above a useful range for your target. Keep a regular bedtime rather than chasing extra hours.",
    };
}

export function lifestyleMetFlag(verdict: LifestyleCheckInVerdict): boolean | null {
    if (verdict === "good") return true;
    if (verdict === "low" || verdict === "high") return false;
    return null;
}
