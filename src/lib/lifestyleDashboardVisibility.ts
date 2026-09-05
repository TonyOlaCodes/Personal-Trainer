import type { LifestyleMetricKey } from "@/lib/lifestylePeriodMetrics";

export const LIFESTYLE_DASHBOARD_KEYS = ["calories", "steps", "sleep"] as const satisfies readonly LifestyleMetricKey[];

export const HIDDEN_GOAL_KEYS = ["weight", "calories", "steps", "sleep"] as const;

export type HiddenGoalKey = (typeof HIDDEN_GOAL_KEYS)[number];

/** Dashboard/Progress visibility. Not a coach-privacy flag. */
export function isLifestyleShownOnDashboard(
    hiddenGoals: Iterable<string> | null | undefined,
    key: LifestyleMetricKey
): boolean {
    if (!hiddenGoals) return true;
    for (const item of hiddenGoals) {
        if (item === key) return false;
    }
    return true;
}

export function visibleLifestyleDashboardKeys(
    hiddenGoals: Iterable<string> | null | undefined
): LifestyleMetricKey[] {
    return LIFESTYLE_DASHBOARD_KEYS.filter((key) => isLifestyleShownOnDashboard(hiddenGoals, key));
}

export function lifestyleDashboardGridClass(count: number): string {
    if (count <= 1) return "grid grid-cols-1";
    if (count === 2) return "grid grid-cols-2";
    return "grid grid-cols-3";
}

function formatLifestyleGoalValue(key: LifestyleMetricKey, target: number): string {
    if (key === "sleep") {
        const rounded = Math.round(target * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }
    return Math.round(target).toLocaleString("en-GB");
}

/** Visual input hint only. Never treat this as a logged value. */
export function lifestyleMetricInputPlaceholder(
    key: LifestyleMetricKey,
    target: number | null | undefined
): string {
    const unit = key === "calories" ? "kcal" : key === "steps" ? "steps" : "hrs";
    if (target == null || !Number.isFinite(target)) return unit;
    return `${formatLifestyleGoalValue(key, target)} ${unit}`;
}

function lifestyleUnit(key: LifestyleMetricKey): string {
    if (key === "calories") return "kcal";
    if (key === "steps") return "steps";
    return "hrs";
}

/** Distance from a real logged value to the goal. Null when unlogged or no goal. */
export function lifestyleGoalDistanceText(
    key: LifestyleMetricKey,
    loggedValue: number | null | undefined,
    target: number | null | undefined
): string | null {
    if (loggedValue == null || !Number.isFinite(loggedValue)) return null;
    if (target == null || !Number.isFinite(target)) return null;

    if (key === "sleep") {
        const value = Math.round(loggedValue * 10) / 10;
        const goal = Math.round(target * 10) / 10;
        const delta = Math.round((goal - value) * 10) / 10;
        if (delta === 0) return "Goal reached";
        const amount = Number.isInteger(Math.abs(delta)) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(1);
        return delta > 0 ? `${amount} hrs to goal` : `${amount} hrs over goal`;
    }

    const value = Math.round(loggedValue);
    const goal = Math.round(target);
    const delta = goal - value;
    if (delta === 0) return "Goal reached";
    const amount = Math.abs(delta).toLocaleString("en-GB");
    const unit = lifestyleUnit(key);
    return delta > 0 ? `${amount} ${unit} to goal` : `${amount} ${unit} over goal`;
}

export function setLifestyleDashboardHidden(
    hiddenGoals: string[],
    key: LifestyleMetricKey,
    showOnDashboard: boolean
): string[] {
    const without = hiddenGoals.filter((item) => item !== key);
    return showOnDashboard ? without : [...without, key];
}

export function sanitizeHiddenGoals(hiddenGoals: Iterable<string> | null | undefined): string[] {
    const allowed = new Set<string>(HIDDEN_GOAL_KEYS);
    const next: string[] = [];
    for (const item of hiddenGoals ?? []) {
        if (allowed.has(item) && !next.includes(item)) next.push(item);
    }
    return next;
}
