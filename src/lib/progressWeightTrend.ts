/** Shared Progress / coach-card wrappers over the canonical bodyweight goal algorithm. */

import { isBodyweightTowardGoal, isLoggedBodyweightKg } from "@/lib/bodyweightGoalProgress";

export function isProgressWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    targetWeightKg: number | null | undefined,
    startWeight: number,
    endWeight: number
): boolean | null {
    void changeKg;
    return isBodyweightTowardGoal({
        baselineKg: startWeight,
        currentKg: endWeight,
        targetKg: targetWeightKg,
        goal,
    });
}

export function bodyweightDistanceToGoal(
    currentKg: number | null | undefined,
    targetKg: number | null | undefined
): number | null {
    if (!isLoggedBodyweightKg(currentKg) || !isLoggedBodyweightKg(targetKg)) return null;
    return Math.abs(currentKg - targetKg);
}
