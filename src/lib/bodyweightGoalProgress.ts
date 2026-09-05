/**
 * Canonical direction-aware bodyweight goal progress.
 * Used by Progress, Dashboard, coach profile, and check-in summaries.
 *
 * Never use current / target. Progress is measured from baseline toward target.
 */

export const WEIGHT_GOAL_EQUAL_KG = 0.25;

export type WeightGoalDirection = "GAINING" | "LOSING" | "MAINTAINING";

export function isLoggedBodyweightKg(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/** Keep legitimate 0; drop missing / non-finite values. */
export function loggedBodyweightPoints<T extends { weight?: number | null; weightKg?: number | null }>(
    rows: T[]
): T[] {
    return rows.filter((row) => {
        const value = row.weightKg ?? row.weight;
        return isLoggedBodyweightKg(value);
    });
}

export function resolveWeightGoalDirection(
    baselineKg: number | null | undefined,
    targetKg: number | null | undefined
): WeightGoalDirection | null {
    if (!isLoggedBodyweightKg(baselineKg) || !isLoggedBodyweightKg(targetKg)) return null;
    if (Math.abs(targetKg - baselineKg) <= WEIGHT_GOAL_EQUAL_KG) return "MAINTAINING";
    return targetKg > baselineKg ? "GAINING" : "LOSING";
}

export function resolveWeightGoalDirectionFromGoal(
    goal: string | null | undefined
): WeightGoalDirection | null {
    switch (goal) {
        case "LOSE_WEIGHT":
            return "LOSING";
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return "GAINING";
        case "RECOMPOSITION":
            return "MAINTAINING";
        default:
            return null;
    }
}

/**
 * 0–100 progress from baseline toward target.
 * Movement away from the target is 0. Exact target is 100. Overshoot stays 100.
 */
export function bodyweightGoalProgressPercent(
    baselineKg: number,
    currentKg: number,
    targetKg: number
): number {
    const direction = resolveWeightGoalDirection(baselineKg, targetKg);
    if (!direction) return 0;

    if (direction === "MAINTAINING") {
        const currentDrift = Math.abs(currentKg - targetKg);
        if (currentDrift <= WEIGHT_GOAL_EQUAL_KG) return 100;
        const startDrift = Math.abs(baselineKg - targetKg);
        if (startDrift <= WEIGHT_GOAL_EQUAL_KG) return 0;
        return Math.max(0, Math.min(100, Math.round((1 - currentDrift / startDrift) * 100)));
    }

    const span = targetKg - baselineKg;
    if (span === 0) return 100;
    const raw = (currentKg - baselineKg) / span;
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function isBodyweightChangeTowardGoal(
    baselineKg: number,
    currentKg: number,
    targetKg: number
): boolean {
    const startDistance = Math.abs(baselineKg - targetKg);
    const endDistance = Math.abs(currentKg - targetKg);
    if (endDistance < startDistance - 0.05) return true;
    if (endDistance > startDistance + 0.05) return false;
    return true;
}

export function isBodyweightTowardGoal(input: {
    baselineKg: number | null | undefined;
    currentKg: number | null | undefined;
    targetKg?: number | null;
    goal?: string | null;
}): boolean | null {
    if (!isLoggedBodyweightKg(input.baselineKg) || !isLoggedBodyweightKg(input.currentKg)) {
        return null;
    }

    if (isLoggedBodyweightKg(input.targetKg)) {
        return isBodyweightChangeTowardGoal(input.baselineKg, input.currentKg, input.targetKg);
    }

    const direction = resolveWeightGoalDirectionFromGoal(input.goal);
    if (!direction) return null;

    const changeKg = input.currentKg - input.baselineKg;
    if (Math.abs(changeKg) < 0.05) return true;
    if (direction === "MAINTAINING") return Math.abs(changeKg) <= 0.5;
    if (direction === "GAINING") return changeKg > 0;
    return changeKg < 0;
}
