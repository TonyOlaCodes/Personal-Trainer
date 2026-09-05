/**
 * Period training / bodyweight / check-in snapshots for the coach client profile.
 * Uses the same scheduled-workout matching as streaks and the calendar.
 */

import { shiftAppDateKey } from "@/lib/appTimezone";
import {
    getPlannedWorkoutForDate,
    isDateAfterPlanEnd,
    isDateBeforePlanStart,
    type ActiveUserPlanLike,
} from "@/lib/planSchedule";
import { isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import { parseLogDate } from "@/lib/utils";
import type { CompletedWorkoutLog } from "@/lib/workoutAdherenceStreak";

export type CoachProfilePeriodKey = "7d" | "30d" | "365d";

export const COACH_PROFILE_PERIODS: Array<{
    key: CoachProfilePeriodKey;
    days: number;
    label: string;
    shortLabel: string;
    previousLabel: string;
}> = [
    { key: "7d", days: 7, label: "Last 7 days", shortLabel: "7 days", previousLabel: "previous 7 days" },
    { key: "30d", days: 30, label: "Last 30 days", shortLabel: "Month", previousLabel: "previous 30 days" },
    { key: "365d", days: 365, label: "Last 365 days", shortLabel: "Year", previousLabel: "previous 365 days" },
];

export function periodMeta(key: CoachProfilePeriodKey) {
    return COACH_PROFILE_PERIODS.find((period) => period.key === key) ?? COACH_PROFILE_PERIODS[1];
}

export function periodWindow(endDateKey: string, days: number): { startDateKey: string; endDateKey: string } {
    return {
        startDateKey: shiftAppDateKey(endDateKey, -(days - 1)),
        endDateKey,
    };
}

export function previousPeriodWindow(
    currentStart: string,
    days: number
): { startDateKey: string; endDateKey: string } {
    const endDateKey = shiftAppDateKey(currentStart, -1);
    return periodWindow(endDateKey, days);
}

export function eachDateKeyInclusive(fromKey: string, toKey: string): string[] {
    const keys: string[] = [];
    let cur = fromKey;
    while (cur <= toKey) {
        keys.push(cur);
        cur = shiftAppDateKey(cur, 1);
    }
    return keys;
}

export function clampPeriodStart(startDateKey: string, accountCreatedKey: string): string {
    return accountCreatedKey > startDateKey ? accountCreatedKey : startDateKey;
}

export function expectedDaysInWindow(startDateKey: string, endDateKey: string, accountCreatedKey: string): number {
    const start = clampPeriodStart(startDateKey, accountCreatedKey);
    if (start > endDateKey) return 0;
    return eachDateKeyInclusive(start, endDateKey).length;
}

export interface PeriodTrainingInput {
    activeUserPlan: ActiveUserPlanLike | null;
    completedLogs: CompletedWorkoutLog[];
    excusedMissedWorkoutKeys?: Iterable<string>;
    historicalMissedSessions?: Array<{ dateKey: string; workoutId: string }>;
    today: Date;
    startDateKey: string;
    endDateKey: string;
}

export interface PeriodTrainingStats {
    scheduled: number;
    completed: number;
    missed: number;
    adherencePercent: number | null;
}

/**
 * Count scheduled training slots in a window.
 * Today is pending (not missed) if the scheduled workout is still unfinished.
 * Excused slots are excluded from the denominator so they cannot manufacture 0% or 100%.
 */
export function computePeriodTrainingStats(input: PeriodTrainingInput): PeriodTrainingStats {
    const todayKey = input.endDateKey;
    const excused = new Set(input.excusedMissedWorkoutKeys ?? []);
    const completed = new Set(input.completedLogs.map((log) => `${log.dateKey}:${log.workoutId}`));
    const countedDates = new Set<string>();

    let scheduled = 0;
    let hits = 0;
    let missed = 0;

    const countSlot = (dateKey: string, workoutId: string) => {
        if (countedDates.has(dateKey)) return;
        const slotKey = `${dateKey}:${workoutId}`;
        if (excused.has(slotKey)) {
            countedDates.add(dateKey);
            return;
        }

        countedDates.add(dateKey);
        scheduled += 1;
        if (completed.has(slotKey)) {
            hits += 1;
            return;
        }
        if (dateKey === todayKey) return;
        missed += 1;
    };

    for (const session of input.historicalMissedSessions ?? []) {
        if (session.dateKey < input.startDateKey || session.dateKey > input.endDateKey) continue;
        if (session.dateKey > todayKey) continue;
        countSlot(session.dateKey, session.workoutId);
    }

    if (input.activeUserPlan?.plan?.weeks?.length) {
        for (const dateKey of eachDateKeyInclusive(input.startDateKey, input.endDateKey)) {
            if (dateKey < todayKey && countedDates.has(dateKey)) continue;
            if (isDateBeforePlanStart(input.activeUserPlan.startedAt, dateKey)) continue;
            if (isDateAfterPlanEnd(input.activeUserPlan.startedAt, input.activeUserPlan.plan.weeks.length, dateKey)) {
                continue;
            }

            const planned = getPlannedWorkoutForDate(input.activeUserPlan, parseLogDate(dateKey), {
                today: input.today,
                dateKey,
            });
            if (!planned || !isScheduledTrainingWorkout(planned)) continue;
            countSlot(dateKey, planned.id);
        }
    }

    return {
        scheduled,
        completed: hits,
        missed,
        adherencePercent: scheduled > 0 ? Math.round((hits / scheduled) * 100) : null,
    };
}

export interface PeriodBodyweightStats {
    currentKg: number | null;
    averageKg: number | null;
    changeKg: number | null;
    entries: number;
}

export function computePeriodBodyweightStats(
    logs: Array<{ date: string; weightKg: number }>,
    startDateKey: string,
    endDateKey: string,
    latestOverallKg: number | null
): PeriodBodyweightStats {
    const inPeriod = logs.filter((row) => {
        const key = row.date.slice(0, 10);
        return key >= startDateKey && key <= endDateKey && Number.isFinite(row.weightKg);
    });

    const entries = inPeriod.length;
    const averageKg = entries === 0
        ? null
        : Math.round((inPeriod.reduce((sum, row) => sum + row.weightKg, 0) / entries) * 10) / 10;

    let changeKg: number | null = null;
    if (entries >= 2) {
        changeKg = Math.round((inPeriod[inPeriod.length - 1].weightKg - inPeriod[0].weightKg) * 10) / 10;
    }

    return {
        currentKg: latestOverallKg,
        averageKg,
        changeKg,
        entries,
    };
}

export interface PeriodCheckInStats {
    submitted: number;
    expected: number | null;
    completionPercent: number | null;
}

export function computePeriodCheckInStats(
    submittedDates: string[],
    startDateKey: string,
    endDateKey: string,
    frequencyWeeks: number | null
): PeriodCheckInStats {
    const submitted = submittedDates.filter((date) => {
        const key = date.slice(0, 10);
        return key >= startDateKey && key <= endDateKey;
    }).length;

    if (frequencyWeeks == null || frequencyWeeks <= 0) {
        return { submitted, expected: null, completionPercent: null };
    }

    const days = eachDateKeyInclusive(startDateKey, endDateKey).length;
    const expected = Math.max(1, Math.round(days / (frequencyWeeks * 7)));
    return {
        submitted,
        expected,
        completionPercent: Math.min(100, Math.round((submitted / expected) * 100)),
    };
}
