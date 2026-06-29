import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface CalendarComplianceInput {
    activePlan: { weeks: ActiveUserPlanLike["plan"]["weeks"] } | null;
    planStartedAt: string | null;
    loggedDates: Array<{ date: string; workoutId?: string }>;
    scheduleRevisions?: ActiveUserPlanLike["scheduleRevisions"];
    /** `${dateKey}:${workoutId}` keys for coach-excused missed workouts */
    excusedMissedWorkoutKeys?: string[];
    /** Frozen missed sessions from before plan edits */
    historicalMissedSessions?: Array<{ dateKey: string; workoutId: string; workoutName: string }>;
}

export interface CalendarComplianceResult {
    completed: number;
    due: number;
    percent: number | null;
}

export interface CalendarComplianceOptions {
    /** Coach view: exclude today from % until the client logs today's planned session. */
    excludeTodayUntilLogged?: boolean;
    /** When range extends past today, pass the real "today" for schedule + today rules. Defaults to range end. */
    referenceToday?: Date;
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

function hasDueSlotOnDate(countedSlots: Set<string>, dateKey: string): boolean {
    for (const slotKey of countedSlots) {
        if (slotKey.startsWith(`${dateKey}:`)) return true;
    }
    return false;
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

export function getWeekEnd(date: Date): Date {
    const mondayKey = toDateKey(getMondayStart(date));
    return parseLogDate(addDaysToDateKey(mondayKey, 6));
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

/** Compliance for a visible calendar month. Current month only counts sessions due so far. */
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
    const rangeOptions: CalendarComplianceOptions = {
        ...options,
        referenceToday: reference,
        excludeTodayUntilLogged: isCurrentMonth ? options?.excludeTodayUntilLogged : false,
    };

    return computeWorkoutCompliance(input, monthStart, rangeEnd, rangeOptions);
}

/** Planned workouts due in range; completed = logged that day. */
export function computeWorkoutCompliance(
    input: CalendarComplianceInput,
    rangeStart: Date,
    rangeEnd: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    const activeUserPlan = toActiveUserPlan(input);
    if (!activeUserPlan) {
        return { completed: 0, due: 0, percent: null };
    }

    const referenceToday = options?.referenceToday ?? rangeEnd;
    const loggedSet = new Set(input.loggedDates.map((l) => l.date));
    const loggedWorkoutSet = new Set(
        input.loggedDates.map((l) => `${l.date}:${l.workoutId ?? ""}`)
    );
    const excusedSet = new Set(input.excusedMissedWorkoutKeys ?? []);
    const countedSlots = new Set<string>();
    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(rangeEnd);
    const todayKey = toDateKey(referenceToday);
    const excludeTodayUntilLogged = options?.excludeTodayUntilLogged ?? false;

    let completed = 0;
    let due = 0;

    for (const dateKey of eachDateKeyInclusive(startKey, endKey)) {
        const day = parseLogDate(dateKey);
        const planned = getPlannedWorkoutForDate(activeUserPlan, day, { today: referenceToday });
        if (!planned) continue;

        const slotKey = `${dateKey}:${planned.id}`;
        const isLogged = loggedWorkoutSet.has(slotKey) || loggedSet.has(dateKey);
        const isExcused = !isLogged && excusedSet.has(slotKey);
        if (excludeTodayUntilLogged && dateKey === todayKey && !isLogged && !isExcused) {
            continue;
        }

        due++;
        if (isLogged || isExcused) {
            completed++;
        }
        countedSlots.add(slotKey);
    }

    for (const session of input.historicalMissedSessions ?? []) {
        if (session.dateKey < startKey || session.dateKey > endKey) continue;
        const slotKey = `${session.dateKey}:${session.workoutId}`;
        if (countedSlots.has(slotKey)) continue;

        const isLogged = loggedWorkoutSet.has(slotKey);
        const isExcused = excusedSet.has(slotKey);
        if (excludeTodayUntilLogged && session.dateKey === todayKey && !isLogged && !isExcused) {
            continue;
        }

        due++;
        countedSlots.add(slotKey);
        if (isLogged || isExcused) {
            completed++;
        }
    }

    // Completed logs from prior schedules / plan switches when live schedule no longer lists that day.
    for (const log of input.loggedDates) {
        if (!log.workoutId) continue;
        if (log.date < startKey || log.date > endKey) continue;
        if (log.date > todayKey) continue;

        const slotKey = `${log.date}:${log.workoutId}`;
        if (countedSlots.has(slotKey)) continue;
        if (hasDueSlotOnDate(countedSlots, log.date)) continue;

        due++;
        completed++;
        countedSlots.add(slotKey);
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
    return computeWorkoutCompliance(input, getMondayStart(today), today, {
        ...options,
        referenceToday: today,
    });
}

export function computeMonthlyCompliance(
    input: CalendarComplianceInput,
    today: Date,
    options?: CalendarComplianceOptions
): CalendarComplianceResult {
    return computeWorkoutCompliance(input, getMonthStart(today), today, {
        ...options,
        referenceToday: today,
    });
}

export function complianceTone(percent: number | null): "success" | "warning" | "danger" | "muted" {
    if (percent === null) return "muted";
    if (percent >= 100) return "success";
    if (percent >= 75) return "warning";
    return "danger";
}
