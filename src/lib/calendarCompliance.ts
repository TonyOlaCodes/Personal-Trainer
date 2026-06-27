import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface CalendarComplianceInput {
    activePlan: { weeks: ActiveUserPlanLike["plan"]["weeks"] } | null;
    planStartedAt: string | null;
    loggedDates: Array<{ date: string }>;
    scheduleRevisions?: ActiveUserPlanLike["scheduleRevisions"];
}

export interface CalendarComplianceResult {
    completed: number;
    due: number;
    percent: number | null;
}

export interface CalendarComplianceOptions {
    /** Coach view: exclude today from % until the client logs today's planned session. */
    excludeTodayUntilLogged?: boolean;
}

function toActiveUserPlan(input: CalendarComplianceInput): ActiveUserPlanLike | null {
    if (!input.activePlan || !input.planStartedAt) return null;
    return {
        startedAt: input.planStartedAt,
        plan: { weeks: input.activePlan.weeks },
        scheduleRevisions: input.scheduleRevisions,
    };
}

function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function eachDateKeyInclusive(fromKey: string, toKey: string): string[] {
    const keys: string[] = [];
    let cur = fromKey;
    while (cur <= toKey) {
        keys.push(cur);
        cur = addDaysToDateKey(cur, 1);
    }
    return keys;
}

export function getMondayStart(date: Date): Date {
    const { dateKey } = getLocalTimeParts(date, APP_TIMEZONE);
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    dt.setUTCDate(dt.getUTCDate() + diff);
    const mondayKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    return parseLogDate(mondayKey);
}

export function getMonthStart(date: Date): Date {
    const { year, month } = getLocalTimeParts(date, APP_TIMEZONE);
    return parseLogDate(`${year}-${String(month).padStart(2, "0")}-01`);
}

export function getMonthEnd(date: Date): Date {
    const { year, month } = getLocalTimeParts(date, APP_TIMEZONE);
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const lastDayKey = addDaysToDateKey(
        `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`,
        -1
    );
    return parseLogDate(lastDayKey);
}

export function isSameCalendarMonth(a: Date, year: number, monthIndex: number): boolean {
    const { year: y, month: m } = getLocalTimeParts(a, APP_TIMEZONE);
    return y === year && m === monthIndex + 1;
}

export function isFutureCalendarMonth(reference: Date, year: number, monthIndex: number): boolean {
    const { year: y, month: m } = getLocalTimeParts(reference, APP_TIMEZONE);
    if (year > y) return true;
    if (year < y) return false;
    return monthIndex + 1 > m;
}

/** Full-month compliance for a visible calendar month (current = month-to-date). */
export function computeComplianceForMonth(
    input: CalendarComplianceInput,
    year: number,
    monthIndex: number,
    reference: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    const monthStart = parseLogDate(`${year}-${String(monthIndex + 1).padStart(2, "0")}-01`);
    const isCurrentMonth = isSameCalendarMonth(reference, year, monthIndex);
    const rangeEnd = isCurrentMonth ? reference : getMonthEnd(monthStart);
    const rangeOptions = isCurrentMonth
        ? options
        : { ...options, excludeTodayUntilLogged: false };

    return computeWorkoutCompliance(input, monthStart, rangeEnd, rangeOptions);
}

/** Planned workouts due in range; completed = logged that day. */
export function computeWorkoutCompliance(
    input: CalendarComplianceInput,
    rangeStart: Date,
    today: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    const activeUserPlan = toActiveUserPlan(input);
    if (!activeUserPlan) {
        return { completed: 0, due: 0, percent: null };
    }

    const loggedSet = new Set(input.loggedDates.map((l) => l.date));
    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(today);
    const todayKey = endKey;
    const excludeTodayUntilLogged = options?.excludeTodayUntilLogged ?? false;

    let completed = 0;
    let due = 0;

    for (const dateKey of eachDateKeyInclusive(startKey, endKey)) {
        const day = parseLogDate(dateKey);
        const planned = getPlannedWorkoutForDate(activeUserPlan, day, { today });
        if (!planned) continue;

        const isLogged = loggedSet.has(dateKey);
        if (excludeTodayUntilLogged && dateKey === todayKey && !isLogged) {
            continue;
        }

        due++;
        if (isLogged) {
            completed++;
        }
    }

    const percent = due > 0 ? Math.round((completed / due) * 100) : null;
    return { completed, due, percent };
}

/** True when today has a planned workout that is not logged yet (coach % waits until done or next day). */
export function hasPendingTodayWorkout(input: CalendarComplianceInput, today: Date): boolean {
    const activeUserPlan = toActiveUserPlan(input);
    if (!activeUserPlan) return false;

    const todayKey = toDateKey(today);
    if (input.loggedDates.some((l) => l.date === todayKey)) return false;

    return Boolean(getPlannedWorkoutForDate(activeUserPlan, parseLogDate(todayKey), { today }));
}

export function computeWeeklyCompliance(
    input: CalendarComplianceInput,
    today: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    return computeWorkoutCompliance(input, getMondayStart(today), today, options);
}

export function computeMonthlyCompliance(
    input: CalendarComplianceInput,
    today: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    return computeWorkoutCompliance(input, getMonthStart(today), today, options);
}

export function complianceTone(percent: number | null): "success" | "warning" | "danger" | "muted" {
    if (percent === null) return "muted";
    if (percent >= 100) return "success";
    if (percent >= 75) return "warning";
    return "danger";
}
