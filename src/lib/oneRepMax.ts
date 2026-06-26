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

/** Best set = highest weight; at equal weight, highest reps. */
export function isBetterSet(
    weight: number,
    reps: number,
    bestWeight: number,
    bestReps: number
): boolean {
    const w = typeof weight === "number" ? weight : Number(weight);
    const r = typeof reps === "number" ? reps : Number(reps);
    const bw = typeof bestWeight === "number" ? bestWeight : Number(bestWeight);
    const br = typeof bestReps === "number" ? bestReps : Number(bestReps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return false;
    if (!Number.isFinite(bw) || !Number.isFinite(br) || bw <= 0 || br <= 0) return true;
    if (w > bw) return true;
    if (w === bw && r > br) return true;
    return false;
}

export function deriveOneRMFromBestSet(weight: number, reps: number): number {
    const w = typeof weight === "number" ? weight : Number(weight);
    const r = typeof reps === "number" ? reps : Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r)) return 0;
    return calculateOneRM(w, Math.round(r));
}
