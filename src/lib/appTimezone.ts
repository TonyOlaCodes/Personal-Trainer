/** App-wide timezone (Ireland). All calendar days, notifications, and schedules use this. */
export const APP_TIMEZONE = "Europe/Dublin";

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** UTC noon for a YYYY-MM-DD calendar date. Weekday of that instant is the date's weekday. */
export function dateKeyToUtcNoon(dateKey: string): Date {
    const match = dateKey.match(DATE_KEY_RE);
    if (!match) {
        throw new Error(`Invalid date key: ${dateKey}`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/** Shift a YYYY-MM-DD key by whole calendar days (timezone-independent). */
export function shiftAppDateKey(dateKey: string, days: number): string {
    const date = dateKeyToUtcNoon(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Sunday=0 … Saturday=6 for a calendar date. */
export function weekdayFromDateKey(dateKey: string): number {
    return dateKeyToUtcNoon(dateKey).getUTCDay();
}

export function mondayOfDateKey(dateKey: string): string {
    const dow = weekdayFromDateKey(dateKey);
    const offset = dow === 0 ? -6 : 1 - dow;
    return shiftAppDateKey(dateKey, offset);
}

export function sundayOfDateKey(dateKey: string): string {
    return shiftAppDateKey(mondayOfDateKey(dateKey), 6);
}

export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
    const from = dateKeyToUtcNoon(fromKey).getTime();
    const to = dateKeyToUtcNoon(toKey).getTime();
    return Math.round((to - from) / 86400000);
}

/** ISO week-numbering year for a calendar date. */
export function isoWeekYearFromDateKey(dateKey: string): number {
    const date = dateKeyToUtcNoon(dateKey);
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    return date.getUTCFullYear();
}
