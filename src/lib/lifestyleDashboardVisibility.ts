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
    if (count === 2) return "grid grid-cols-1 sm:grid-cols-2";
    return "grid grid-cols-1 sm:grid-cols-3";
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
