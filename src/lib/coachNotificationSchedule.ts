/**
 * Coach notification delivery times (HH:mm, 24h) and timezone helpers.
 * App calendar/notifications use {@link APP_TIMEZONE} from appTimezone.ts.
 */

export type CoachNotificationPref =
    | "notifyOnWorkout"
    | "notifyOnCheckIn"
    | "notifyOnMetricUpdate"
    | "notifyOnMissedCheckIn"
    | "notifyOnMissedWorkout";

export const COACH_NOTIFY_PREF_TO_TIME_FIELD: Record<CoachNotificationPref, string> = {
    notifyOnWorkout: "notifyOnWorkoutTime",
    notifyOnCheckIn: "notifyOnCheckInTime",
    notifyOnMetricUpdate: "notifyOnMetricUpdateTime",
    notifyOnMissedCheckIn: "notifyOnMissedCheckInTime",
    notifyOnMissedWorkout: "notifyOnMissedWorkoutTime",
};

/** Default: next morning after a missed due day (coach/client can override in Settings). */
export const DEFAULT_MISSED_NOTIFY_TIME = "09:00";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseNotifyTime(value: string | null | undefined): { hour: number; minute: number } | null {
    if (!value || !TIME_RE.test(value)) return null;
    const [hour, minute] = value.split(":").map(Number);
    return { hour, minute };
}

export function normalizeNotifyTime(value: string | null | undefined): string | null {
    const parsed = parseNotifyTime(value ?? "");
    if (!parsed) return null;
    return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

export function isValidTimezone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export function getLocalTimeParts(date: Date, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    dateKey: string;
} {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour") % 24;
    const minute = get("minute");

    return {
        year,
        month,
        day,
        hour,
        minute,
        dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
}

/** True when local clock matches configured HH:mm (used with cron ticks). */
export function localTimeMatchesNotifySlot(
    now: Date,
    timezone: string,
    notifyTime: string,
    windowMinutes = 15
): boolean {
    const config = parseNotifyTime(notifyTime);
    if (!config) return false;
    const local = getLocalTimeParts(now, timezone);
    const nowMinutes = local.hour * 60 + local.minute;
    const targetMinutes = config.hour * 60 + config.minute;
    if (windowMinutes <= 0) {
        return nowMinutes === targetMinutes;
    }
    return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes;
}

/** True when local clock is at or past HH:mm (for once-daily cron). */
export function localNotifyTimeReached(now: Date, timezone: string, notifyTime: string): boolean {
    const config = parseNotifyTime(notifyTime);
    if (!config) return false;
    const local = getLocalTimeParts(now, timezone);
    const nowMinutes = local.hour * 60 + local.minute;
    const targetMinutes = config.hour * 60 + config.minute;
    return nowMinutes >= targetMinutes;
}

/** True once local clock is at or past the configured delivery time (for daily cron). */
export function shouldDeliverMissedAlertNow(now: Date, timezone: string, notifyTime: string): boolean {
    return localNotifyTimeReached(now, timezone, notifyTime);
}

/** @deprecated Use shouldDeliverMissedAlertNow */
export function shouldRunMissedAlertScan(now: Date, timezone: string, notifyTime: string): boolean {
    return shouldDeliverMissedAlertNow(now, timezone, notifyTime);
}

export function shiftDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** UTC instant for the next occurrence of HH:mm in the given timezone. */
export function nextDeliveryUtc(timezone: string, notifyTime: string, from = new Date()): Date {
    const config = parseNotifyTime(notifyTime);
    if (!config) return from;

    const local = getLocalTimeParts(from, timezone);
    let targetDay = local.day;
    let targetMonth = local.month;
    let targetYear = local.year;

    const nowMinutes = local.hour * 60 + local.minute;
    const targetMinutes = config.hour * 60 + config.minute;
    if (nowMinutes >= targetMinutes) {
        const d = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay));
        d.setUTCDate(d.getUTCDate() + 1);
        targetYear = d.getUTCFullYear();
        targetMonth = d.getUTCMonth() + 1;
        targetDay = d.getUTCDate();
    }

    const guess = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, config.hour, config.minute, 0, 0));
    for (let offsetHours = -14; offsetHours <= 14; offsetHours++) {
        const candidate = new Date(guess.getTime() + offsetHours * 3600000);
        const parts = getLocalTimeParts(candidate, timezone);
        if (
            parts.year === targetYear
            && parts.month === targetMonth
            && parts.day === targetDay
            && parts.hour === config.hour
            && parts.minute === config.minute
        ) {
            return candidate;
        }
    }

    return guess;
}

export function localDayBoundsUtc(dateKey: string, timezone: string): { start: Date; end: Date } {
    const [y, m, d] = dateKey.split("-").map(Number);
    const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));

    let start = new Date(noonUtc.getTime() - 12 * 3600000);
    let end = new Date(noonUtc.getTime() + 12 * 3600000);

    for (const candidate of [
        start,
        new Date(start.getTime() - 3600000),
        new Date(start.getTime() + 3600000),
    ]) {
        const p = getLocalTimeParts(candidate, timezone);
        if (p.dateKey === dateKey && p.hour === 0 && p.minute === 0) {
            start = candidate;
            break;
        }
    }

    for (const candidate of [
        end,
        new Date(end.getTime() - 3600000),
        new Date(end.getTime() + 3600000),
    ]) {
        const p = getLocalTimeParts(candidate, timezone);
        if (p.hour === 23 && p.minute === 59) {
            end = new Date(candidate.getTime() + 60000);
            break;
        }
    }

    return { start, end };
}

export interface CoachNotificationSchedule {
    timezone: string;
    notifyOnWorkoutTime: string | null;
    notifyOnCheckInTime: string | null;
    notifyOnMetricUpdateTime: string | null;
    notifyOnMissedCheckInTime: string | null;
    notifyOnMissedWorkoutTime: string | null;
}

export function deliveryModeForPref(
    schedule: CoachNotificationSchedule,
    pref: CoachNotificationPref
): "immediate" | "scheduled" {
    const field = COACH_NOTIFY_PREF_TO_TIME_FIELD[pref] as keyof CoachNotificationSchedule;
    const time = schedule[field];
    return typeof time === "string" && time.length > 0 ? "scheduled" : "immediate";
}
