/** Shared Progress / coach-card weight-direction helper. Not the check-in rate cap. */

export function isProgressWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    targetWeightKg: number | null | undefined,
    startWeight: number,
    endWeight: number
): boolean | null {
    if (Math.abs(changeKg) < 0.05) return true;

    if (targetWeightKg != null && Number.isFinite(targetWeightKg)) {
        const startDistance = Math.abs(startWeight - targetWeightKg);
        const endDistance = Math.abs(endWeight - targetWeightKg);
        if (endDistance < startDistance - 0.05) return true;
        if (endDistance > startDistance + 0.05) return false;
    }

    switch (goal) {
        case "LOSE_WEIGHT":
            return changeKg < 0;
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return changeKg > 0;
        case "RECOMPOSITION":
            return Math.abs(changeKg) <= 0.5;
        default:
            if (targetWeightKg != null && Number.isFinite(targetWeightKg)) {
                return Math.abs(endWeight - targetWeightKg) <= Math.abs(startWeight - targetWeightKg);
            }
            return null;
    }
}

export function bodyweightDistanceToGoal(
    currentKg: number | null | undefined,
    targetKg: number | null | undefined
): number | null {
    if (currentKg == null || targetKg == null) return null;
    if (!Number.isFinite(currentKg) || !Number.isFinite(targetKg)) return null;
    return Math.abs(currentKg - targetKg);
}
