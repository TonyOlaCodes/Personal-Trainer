/** Percent of 1RM by rep count (1–10) at RPE 6…10 in 0.5 steps (RTS chart). */
const RPE_PERCENT_BY_REPS: number[][] = [
    [86.3, 87.8, 89.2, 90.7, 92.2, 93.9, 95.5, 97.8, 100],
    [83.7, 84.9, 86.3, 87.8, 89.2, 90.7, 92.2, 93.9, 95.5],
    [81.1, 82.2, 83.7, 84.9, 86.3, 87.8, 89.2, 90.7, 92.2],
    [78.6, 79.7, 81.1, 82.2, 83.7, 84.9, 86.3, 87.8, 89.2],
    [76.2, 77.3, 78.6, 79.7, 81.1, 82.2, 83.7, 84.9, 86.3],
    [73.9, 74.8, 76.2, 77.3, 78.6, 79.7, 81.1, 82.2, 83.7],
    [70.7, 72.3, 73.9, 74.8, 76.2, 77.3, 78.6, 79.7, 81.1],
    [68.0, 69.4, 70.7, 72.3, 73.9, 74.8, 76.2, 77.3, 78.6],
    [65.3, 66.7, 68.0, 69.4, 70.7, 72.3, 73.9, 74.8, 76.2],
    [62.4, 63.9, 65.3, 66.7, 68.0, 69.4, 70.7, 72.3, 73.9],
];

function parseRpeInput(rpe: number | string | null | undefined): number | null {
    if (rpe === null || rpe === undefined || rpe === "") return null;
    const n = typeof rpe === "number" ? rpe : Number(rpe);
    if (!Number.isFinite(n)) return null;
    return n;
}

function getRpePercentOfOneRM(reps: number, rpe: number): number {
    const repIdx = Math.min(Math.max(Math.round(reps), 1), 10) - 1;
    const clampedRpe = Math.min(Math.max(rpe, 6), 10);
    const rpeFraction = (clampedRpe - 6) * 2;
    const lowerIdx = Math.floor(rpeFraction);
    const upperIdx = Math.min(lowerIdx + 1, 8);
    const frac = rpeFraction - lowerIdx;
    const row = RPE_PERCENT_BY_REPS[repIdx];
    return row[lowerIdx] + (row[upperIdx] - row[lowerIdx]) * frac;
}

function calculateWithoutRpe(weight: number, reps: number): number {
    if (reps === 1) return Math.round(weight);
    if (reps <= 10) return Math.round(weight / (1.0278 - 0.0278 * reps));
    return Math.round(weight * (1 + reps / 30));
}

/**
 * Estimated one-rep max.
 * - With RPE (6–10) and reps ≤ 10: RTS RPE chart (weight ÷ %1RM).
 * - Without RPE: Brzycki for reps ≤ 10, Epley for reps > 10.
 */
export function calculateOneRM(
    weight: number,
    reps: number,
    rpe?: number | string | null
): number {
    if (weight <= 0 || reps <= 0) return 0;

    const parsedRpe = parseRpeInput(rpe);
    if (parsedRpe !== null && parsedRpe >= 6 && parsedRpe <= 10 && reps <= 10) {
        const pct = getRpePercentOfOneRM(reps, parsedRpe);
        if (pct > 0) return Math.round(weight / (pct / 100));
    }

    return calculateWithoutRpe(weight, reps);
}
