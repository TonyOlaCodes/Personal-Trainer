/**
 * The single source of truth for "does this user have a workout in progress".
 *
 * A user has at most one active session at a time. It stays resumable regardless of
 * what the plan says about today — a scheduled rest day, a missed day being caught
 * up, or an app restart must never hide it. Every surface that offers Resume reads
 * this module rather than querying `workoutLog` itself.
 */

import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";

export interface ActiveWorkoutSession {
    id: string;
    workoutId: string;
    workoutName: string;
    /** ISO timestamp of the calendar day the session is being logged against. */
    loggedAt: string;
    /** `YYYY-MM-DD` in app timezone — the day the session belongs to. */
    dateKey: string;
    /** ISO timestamp of the last save. */
    updatedAt: string;
    /** Minutes elapsed as last persisted by the workout screen. */
    durationMinutes: number | null;
    /** Sets with data entered so far, so callers can show real progress. */
    completedSetCount: number;
    totalSetCount: number;
    /** True when the session is being logged for a day other than today. */
    isBackdated: boolean;
}

/**
 * The user's active workout, or null. Based on IN_PROGRESS status — not recency,
 * presence, or plan schedule. Cleans up drafts that were superseded by a completed
 * log for the same workout and day before deciding.
 *
 * Abandoned sessions stay IN_PROGRESS and remain resumable. They are never silently
 * completed or deleted for being old.
 */
export async function getActiveWorkoutSession(
    userId: string,
    options?: { skipCleanup?: boolean }
): Promise<ActiveWorkoutSession | null> {
    if (!options?.skipCleanup) {
        await cleanupStaleInProgressSessions(userId);
    }

    const log = await prisma.workoutLog.findFirst({
        where: {
            userId,
            status: "IN_PROGRESS",
        },
        select: {
            id: true,
            workoutId: true,
            loggedAt: true,
            updatedAt: true,
            duration: true,
            workout: { select: { name: true } },
            sets: { select: { isCompleted: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    if (!log) return null;

    const dateKey = getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey;
    const todayKey = getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey;

    return {
        id: log.id,
        workoutId: log.workoutId,
        workoutName: log.workout.name,
        loggedAt: log.loggedAt.toISOString(),
        dateKey,
        updatedAt: log.updatedAt.toISOString(),
        durationMinutes: log.duration ?? null,
        completedSetCount: log.sets.filter((set) => set.isCompleted).length,
        totalSetCount: log.sets.length,
        isBackdated: dateKey !== todayKey,
    };
}

/**
 * Enforces one active workout per user: any other in-progress draft is dropped
 * before a new session starts.
 *
 * Only ever touches IN_PROGRESS rows, never completed history.
 */
export async function closeOtherActiveSessions(input: {
    userId: string;
    keepWorkoutId: string;
    keepDayStart: Date;
    keepDayEnd: Date;
}): Promise<number> {
    const result = await prisma.workoutLog.deleteMany({
        where: {
            userId: input.userId,
            status: "IN_PROGRESS",
            NOT: {
                workoutId: input.keepWorkoutId,
                loggedAt: { gte: input.keepDayStart, lte: input.keepDayEnd },
            },
        },
    });
    return result.count;
}

/** Deep link that resumes the session on the correct calendar day. */
export function resumeWorkoutHref(session: Pick<ActiveWorkoutSession, "workoutId" | "dateKey">): string {
    return `/plans/log/${session.workoutId}?date=${session.dateKey}`;
}
