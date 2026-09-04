/**
 * Session-by-session history for a single exercise.
 *
 * Shared source of truth for the coach Exercise History Inspector — the plan
 * editor, Edit Session and the client profile progression section all read this,
 * so none of them can drift into their own history maths.
 *
 * Only legitimate completed performance is returned: completed logs, completed
 * non-warmup sets, matched by canonical exercise identity so aliases such as
 * "Pull Ups" and "Pull-Up" share one timeline. Plan targets are never treated as
 * performed work.
 */

import { APP_TIMEZONE } from "@/lib/appTimezone";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { isWorkingSet } from "@/lib/exercisePrs";
import { loadWorkoutHistorySessions, type LoadedHistorySession } from "@/lib/workoutHistory";
import type { ExerciseHistorySession, ExerciseHistorySet } from "@/lib/exerciseHistoryFormat";

/** Sessions kept for the inspector — deep enough to judge progression, bounded. */
export const DEFAULT_EXERCISE_HISTORY_SESSIONS = 30;

/** How much raw training history to scan when looking for one exercise. */
const HISTORY_SCAN_LIMIT = 600;

function dayLabelFor(loggedAt: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        timeZone: APP_TIMEZONE,
    })
        .format(loggedAt)
        .toUpperCase();
}

function dateLabelFor(loggedAt: Date): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: APP_TIMEZONE,
    }).formatToParts(loggedAt);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";

    // en-GB renders September as "Sept"; clamp to three letters for a uniform column.
    const month = get("month").replace(".", "").slice(0, 3).toUpperCase();
    return `${get("day")} ${month} ${get("year")}`;
}

/** Group one loaded session's matching sets, or null when the exercise is absent. */
export function extractExerciseSession(
    session: LoadedHistorySession,
    identityKey: string
): ExerciseHistorySession | null {
    const sets: ExerciseHistorySet[] = session.sets
        .filter(
            (set) =>
                exerciseIdentityKey(set.exerciseName) === identityKey
                && isWorkingSet(set)
        )
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
            setNumber: set.setNumber,
            weightKg: set.weightKg,
            reps: set.reps,
            rpe: set.rpe,
            durationSec: set.durationSec,
            distanceMeters: set.distanceMeters,
            heightCm: set.heightCm,
            resistance: set.resistance,
            inclinePct: set.inclinePct,
            calories: set.calories,
            heartRate: set.heartRate,
            speedKph: set.speedKph,
            isPR: set.isPR,
        }));

    if (sets.length === 0) return null;

    const loggedAt = new Date(session.loggedAt);
    return {
        logId: session.logId,
        workoutId: session.workoutId,
        workoutName: session.workoutName,
        dateKey: session.dateKey,
        loggedAt: session.loggedAt,
        dayLabel: dayLabelFor(loggedAt),
        dateLabel: dateLabelFor(loggedAt),
        sets,
    };
}

export interface ExerciseSessionHistoryResult {
    /** The name as asked for, so callers can match results without relying on order. */
    requested: string;
    /** Canonical identity key; empty when the name could not be resolved. */
    key: string;
    /** Canonical display spelling. */
    name: string;
    /** Newest session first. */
    sessions: ExerciseHistorySession[];
    /** True when older sessions exist beyond the returned window. */
    hasMore: boolean;
}

/**
 * Very short-lived scan memo.
 *
 * The plan editor looks history up while the coach types exercise names, and each
 * lookup would otherwise re-read every completed log for that client. A few seconds
 * of staleness is invisible here — history only changes when the athlete finishes
 * a workout.
 */
const SCAN_CACHE_TTL_MS = 15_000;
const scanCache = new Map<string, { at: number; sessions: LoadedHistorySession[] }>();

async function scanHistory(
    userId: string,
    excludeLogId?: string
): Promise<LoadedHistorySession[]> {
    const key = `${userId}::${excludeLogId ?? ""}`;
    const now = Date.now();
    const hit = scanCache.get(key);
    if (hit && now - hit.at < SCAN_CACHE_TTL_MS) return hit.sessions;

    const sessions = await loadWorkoutHistorySessions(userId, {
        limit: HISTORY_SCAN_LIMIT,
        excludeLogId,
    });

    // Bound the map so a busy coach instance cannot grow it without limit.
    if (scanCache.size > 50) scanCache.clear();
    scanCache.set(key, { at: now, sessions });
    return sessions;
}

/**
 * Completed sessions for several exercises at once.
 *
 * Training history is scanned once and fanned out per exercise — the plan editor
 * asks for every exercise on the day at the same time, and a scan per exercise
 * would be needlessly expensive.
 */
export async function loadExerciseSessionHistoryBatch(
    userId: string,
    exerciseNames: string[],
    options?: { limit?: number; excludeLogId?: string }
): Promise<ExerciseSessionHistoryResult[]> {
    const resolved = exerciseNames.map((raw) => {
        const name = canonicalExerciseName(raw) || raw;
        return { requested: raw, name, key: exerciseIdentityKey(name) };
    });

    if (resolved.every((entry) => !entry.key)) {
        return resolved.map((entry) => ({
            requested: entry.requested,
            key: "",
            name: entry.name,
            sessions: [],
            hasMore: false,
        }));
    }

    const history = await scanHistory(userId, options?.excludeLogId);
    const limit = options?.limit ?? DEFAULT_EXERCISE_HISTORY_SESSIONS;

    return resolved.map((entry) => {
        if (!entry.key) {
            return {
                requested: entry.requested,
                key: "",
                name: entry.name,
                sessions: [],
                hasMore: false,
            };
        }

        const matched: ExerciseHistorySession[] = [];
        let hasMore = false;

        // `loadWorkoutHistorySessions` is already newest-first.
        for (const session of history) {
            const extracted = extractExerciseSession(session, entry.key);
            if (!extracted) continue;
            if (matched.length >= limit) {
                hasMore = true;
                break;
            }
            matched.push(extracted);
        }

        return {
            requested: entry.requested,
            key: entry.key,
            name: entry.name,
            sessions: matched,
            hasMore,
        };
    });
}

/**
 * Completed sessions containing this exercise, newest first.
 */
export async function loadExerciseSessionHistory(
    userId: string,
    exerciseName: string,
    options?: { limit?: number; excludeLogId?: string }
): Promise<ExerciseSessionHistoryResult> {
    const [result] = await loadExerciseSessionHistoryBatch(userId, [exerciseName], options);
    return result;
}
