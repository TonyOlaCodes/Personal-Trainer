/**
 * Isomorphic display helpers for the exercise history inspector.
 *
 * Kept separate from `exerciseSessionHistory.ts` (which pulls in Prisma) so client
 * components can format the same payload the server produced.
 */

import type { UnitSystem } from "@/lib/units";
import { kgToLbsNumber } from "@/lib/units";
import {
    formatDistanceMeters,
    formatDurationSec,
    formatHeightCm,
    formatSpeedKph,
} from "@/lib/exerciseTracking/format";
import { isFieldEnabled } from "@/lib/exerciseTracking/schema";
import type { ExerciseTrackingSchema } from "@/lib/exerciseTracking/types";

export interface ExerciseHistorySet {
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rpe: number | null;
    durationSec: number | null;
    distanceMeters: number | null;
    heightCm: number | null;
    resistance: number | null;
    inclinePct: number | null;
    calories: number | null;
    heartRate: number | null;
    speedKph: number | null;
    isPR: boolean;
}

export interface ExerciseHistorySession {
    logId: string;
    workoutId: string;
    /** Actual workout/session name as the plan called it, e.g. "Upper". */
    workoutName: string;
    dateKey: string;
    loggedAt: string;
    /** e.g. "MONDAY" */
    dayLabel: string;
    /** e.g. "2 SEP 2026" */
    dateLabel: string;
    sets: ExerciseHistorySet[];
}

/** Trim trailing zeros so 80 shows as "80" and 82.5 as "82.5". */
function trimNumber(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatHistoryWeight(
    weightKg: number | null | undefined,
    unitSystem: UnitSystem
): string {
    if (weightKg == null || !Number.isFinite(weightKg)) return "";
    if (unitSystem === "IMPERIAL") {
        return `${trimNumber(Math.round(kgToLbsNumber(weightKg) * 10) / 10)}lb`;
    }
    return `${trimNumber(weightKg)}kg`;
}

/**
 * One compact performance line for a logged set, following the exercise's tracking
 * type: `80kg × 5 · RPE 8` for strength, `45s · RPE 7` for timed.
 *
 * RPE is only ever appended when it was actually recorded — never defaulted.
 */
export function formatHistorySetLine(
    set: ExerciseHistorySet,
    schema: ExerciseTrackingSchema,
    unitSystem: UnitSystem = "METRIC"
): string {
    const parts: string[] = [];

    const hasWeight = (set.weightKg ?? 0) > 0;
    const hasReps = (set.reps ?? 0) > 0;

    // Strength-style pairing reads best as a single "weight × reps" token.
    if (hasWeight && hasReps) {
        parts.push(`${formatHistoryWeight(set.weightKg, unitSystem)} × ${set.reps}`);
    } else if (hasWeight) {
        parts.push(formatHistoryWeight(set.weightKg, unitSystem));
    } else if (hasReps) {
        parts.push(`${set.reps} reps`);
    }

    if ((set.durationSec ?? 0) > 0) parts.push(formatDurationSec(set.durationSec));
    if ((set.distanceMeters ?? 0) > 0) {
        parts.push(formatDistanceMeters(set.distanceMeters, unitSystem));
    }
    if ((set.heightCm ?? 0) > 0) parts.push(formatHeightCm(set.heightCm, unitSystem));
    if ((set.speedKph ?? 0) > 0) parts.push(formatSpeedKph(set.speedKph, unitSystem));
    if (isFieldEnabled(schema, "resistance") && set.resistance != null) {
        parts.push(`Lvl ${trimNumber(set.resistance)}`);
    }
    if (isFieldEnabled(schema, "incline") && set.inclinePct != null) {
        parts.push(`${trimNumber(set.inclinePct)}%`);
    }
    if ((set.calories ?? 0) > 0) parts.push(`${Math.round(set.calories!)} kcal`);
    if ((set.heartRate ?? 0) > 0) parts.push(`${set.heartRate} bpm`);

    // Only shown when genuinely logged — no placeholder RPE values.
    if (set.rpe != null) parts.push(`RPE ${set.rpe}`);

    return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Compact "UPPER · MONDAY" style context label for a session group. */
export function formatSessionContext(session: ExerciseHistorySession): string {
    const name = session.workoutName?.trim();
    if (!name) return session.dayLabel;
    return `${name} · ${session.dayLabel}`;
}
