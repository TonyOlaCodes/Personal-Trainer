import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface CalendarComplianceInput {
    activePlan: { weeks: ActiveUserPlanLike["plan"]["weeks"] } | null;
    planStartedAt: string | null;
    loggedDates: Array<{ date: string }>;
}

export interface CalendarComplianceResult {
    completed: number;
    due: number;
    percent: number | null;
}

function toActiveUserPlan(input: CalendarComplianceInput): ActiveUserPlanLike | null {
    if (!input.activePlan || !input.planStartedAt) return null;
    return {
        startedAt: input.planStartedAt,
        plan: { weeks: input.activePlan.weeks },
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

/** Planned workouts due from rangeStart through today (inclusive); completed = logged that day. */
export function computeWorkoutCompliance(
    input: CalendarComplianceInput,
    rangeStart: Date,
    today: Date
): CalendarComplianceResult {
    const activeUserPlan = toActiveUserPlan(input);
    if (!activeUserPlan) {
        return { completed: 0, due: 0, percent: null };
    }

    const loggedSet = new Set(input.loggedDates.map((l) => l.date));
    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(today);

    let completed = 0;
    let due = 0;

    for (const dateKey of eachDateKeyInclusive(startKey, endKey)) {
        const day = parseLogDate(dateKey);
        const planned = getPlannedWorkoutForDate(activeUserPlan, day);
        if (!planned) continue;

        due++;
        if (loggedSet.has(dateKey)) {
            completed++;
        }
    }

    const percent = due > 0 ? Math.round((completed / due) * 100) : null;
    return { completed, due, percent };
}

export function computeWeeklyCompliance(input: CalendarComplianceInput, today: Date): CalendarComplianceResult {
    return computeWorkoutCompliance(input, getMondayStart(today), today);
}

export function computeMonthlyCompliance(input: CalendarComplianceInput, today: Date): CalendarComplianceResult {
    return computeWorkoutCompliance(input, getMonthStart(today), today);
}

export function complianceTone(percent: number | null): "success" | "warning" | "danger" | "muted" {
    if (percent === null) return "muted";
    if (percent >= 100) return "success";
    if (percent >= 75) return "warning";
    return "danger";
}
