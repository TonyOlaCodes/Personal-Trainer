/**
 * Estimated one-rep max from weight and reps only.
 * Brzycki for reps ≤ 10, Epley for reps > 10.
 */
export function calculateOneRM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return Math.round(weight);
    if (reps <= 10) return Math.round(weight / (1.0278 - 0.0278 * reps));
    return Math.round(weight * (1 + reps / 30));
}
