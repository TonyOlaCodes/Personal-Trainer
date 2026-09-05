/**
 * Fixed scheduled check-in periods.
 * A period is frequencyWeeks * 7 days ending on the configured check-in day
 * (Europe/Dublin date keys). Identity is the due date key, not ISO week.
 */

import { shiftAppDateKey } from "@/lib/appTimezone";
import { formatDate } from "@/lib/utils";
import {
    getFirstEligibleDueDate,
    getNextScheduledDueDateAfter,
    getScheduledDueDateOnOrBefore,
    toCheckInCalendarDate,
    type CheckInSchedule,
} from "@/lib/checkInSchedule";
import { toDateKey } from "@/lib/utils";

export type ScheduledCheckInPeriod = {
    /** Canonical period identity — YYYY-MM-DD of the scheduled check-in day. */
    dueDateKey: string;
    startDateKey: string;
    endDateKey: string;
    label: string;
    frequencyWeeks: number;
    isCurrent: boolean;
    isFuture: boolean;
    isPast: boolean;
};

function periodLengthDays(frequencyWeeks: number): number {
    return Math.max(1, frequencyWeeks) * 7;
}

export function scheduledPeriodWindow(
    dueDateKey: string,
    frequencyWeeks: number
): { startDateKey: string; endDateKey: string } {
    const days = periodLengthDays(frequencyWeeks);
    return {
        startDateKey: shiftAppDateKey(dueDateKey, -(days - 1)),
        endDateKey: dueDateKey,
    };
}

export function formatScheduledPeriodLabel(startDateKey: string, endDateKey: string): string {
    const start = formatDate(startDateKey, { year: undefined, month: "short" });
    const endYear = Number(endDateKey.slice(0, 4));
    const startYear = Number(startDateKey.slice(0, 4));
    const end = formatDate(endDateKey, {
        year: startYear === endYear ? undefined : "numeric",
        month: "short",
    });
    return `${start} to ${end}`;
}

export function buildScheduledPeriod(
    dueDateKey: string,
    frequencyWeeks: number,
    todayKey: string
): ScheduledCheckInPeriod {
    const window = scheduledPeriodWindow(dueDateKey, frequencyWeeks);
    return {
        dueDateKey,
        startDateKey: window.startDateKey,
        endDateKey: window.endDateKey,
        label: formatScheduledPeriodLabel(window.startDateKey, window.endDateKey),
        frequencyWeeks,
        isCurrent: todayKey >= window.startDateKey && todayKey <= window.endDateKey,
        isFuture: window.startDateKey > todayKey,
        isPast: window.endDateKey < todayKey,
    };
}

export function isCheckInScheduleConfigured(
    schedule: Pick<CheckInSchedule, "day" | "frequencyWeeks">
): boolean {
    return (
        schedule.day != null
        && schedule.day >= 0
        && schedule.day <= 6
        && !!schedule.frequencyWeeks
        && schedule.frequencyWeeks > 0
    );
}

/** Period that contains dateKey. Before the first period, returns that first upcoming period. */
export function scheduledPeriodContainingDate(
    schedule: CheckInSchedule,
    dateKey: string,
    todayKey = dateKey
): ScheduledCheckInPeriod | null {
    if (!isCheckInScheduleConfigured(schedule)) return null;

    const day = schedule.day as number;
    const frequencyWeeks = schedule.frequencyWeeks as number;
    const cleanDate = toCheckInCalendarDate(dateKey);
    const cleanStart = schedule.startDate
        ? toCheckInCalendarDate(schedule.startDate)
        : cleanDate;
    const firstEligible = getFirstEligibleDueDate(cleanStart, day);
    const firstKey = toDateKey(firstEligible);
    const firstWindow = scheduledPeriodWindow(firstKey, frequencyWeeks);

    if (dateKey < firstWindow.startDateKey) {
        return buildScheduledPeriod(firstKey, frequencyWeeks, todayKey);
    }

    const dueOnOrBefore = getScheduledDueDateOnOrBefore(firstEligible, frequencyWeeks, cleanDate);
    if (dueOnOrBefore) {
        const dueKey = toDateKey(dueOnOrBefore);
        const window = scheduledPeriodWindow(dueKey, frequencyWeeks);
        if (dateKey >= window.startDateKey && dateKey <= window.endDateKey) {
            return buildScheduledPeriod(dueKey, frequencyWeeks, todayKey);
        }
    }

    const nextDue = getNextScheduledDueDateAfter(firstEligible, frequencyWeeks, cleanDate);
    return buildScheduledPeriod(toDateKey(nextDue), frequencyWeeks, todayKey);
}

export function listScheduledCheckInPeriods(
    schedule: CheckInSchedule,
    todayKey: string,
    options?: { past?: number; future?: number }
): ScheduledCheckInPeriod[] {
    if (!isCheckInScheduleConfigured(schedule)) return [];

    const day = schedule.day as number;
    const frequencyWeeks = schedule.frequencyWeeks as number;
    const past = options?.past ?? 12;
    const future = options?.future ?? 2;
    const today = toCheckInCalendarDate(todayKey);
    const cleanStart = schedule.startDate
        ? toCheckInCalendarDate(schedule.startDate)
        : today;
    const firstEligible = getFirstEligibleDueDate(cleanStart, day);
    const firstKey = toDateKey(firstEligible);

    const current = scheduledPeriodContainingDate(schedule, todayKey, todayKey);
    const currentDue = current?.dueDateKey ?? firstKey;

    const dueKeys: string[] = [];
    let cursor = currentDue;
    for (let i = 0; i < past; i++) {
        const prev = shiftAppDateKey(cursor, -periodLengthDays(frequencyWeeks));
        if (prev < firstKey) break;
        dueKeys.unshift(prev);
        cursor = prev;
    }
    dueKeys.push(currentDue);
    cursor = currentDue;
    for (let i = 0; i < future; i++) {
        cursor = shiftAppDateKey(cursor, periodLengthDays(frequencyWeeks));
        dueKeys.push(cursor);
    }

    const seen = new Set<string>();
    return dueKeys
        .filter((key) => {
            if (seen.has(key) || key < firstKey) return false;
            seen.add(key);
            return true;
        })
        .map((key) => buildScheduledPeriod(key, frequencyWeeks, todayKey))
        .sort((a, b) => (a.dueDateKey < b.dueDateKey ? 1 : -1));
}

/** Default period for a new check-in: the period containing today, never a previous missed one. */
export function defaultCheckInPeriod(
    schedule: CheckInSchedule,
    todayKey: string
): ScheduledCheckInPeriod | null {
    return scheduledPeriodContainingDate(schedule, todayKey, todayKey);
}
