import { prisma } from "@/lib/prisma";
import { getWeekNumber, parseLogDate, toDateKey } from "@/lib/utils";

export interface CheckInSchedule {
    day: number | null;
    frequencyWeeks: number | null;
    startDate: string | null;
}

export interface CheckInDueState extends CheckInSchedule {
    isConfigured: boolean;
    /** True when there is an open due/overdue period awaiting submission. */
    isDueWeek: boolean;
    isDueToday: boolean;
    isOverdue: boolean;
    daysUntilNext: number | null;
    /** Days past the outstanding due date when overdue; otherwise null. */
    daysOverdue: number | null;
    nextDueDate: string | null;
    dueDayLabel: string | null;
    /** Calendar due date for the open period (due today or overdue). */
    currentPeriodDueDate: string | null;
    /** ISO week number of the open period due date (for submissions / dismiss keys). */
    outstandingWeekNumber: number | null;
}

export const CHECK_IN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let checkInScheduleReady = false;

export async function ensureCheckInScheduleColumns() {
    if (checkInScheduleReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "checkInDay" INTEGER,
        ADD COLUMN IF NOT EXISTS "checkInFrequencyWeeks" INTEGER,
        ADD COLUMN IF NOT EXISTS "checkInStartDate" TIMESTAMP(3)
    `;

    checkInScheduleReady = true;
}

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("does not exist") || msg.includes("P2010") || msg.includes("relation") || msg.includes("column")) {
            console.warn("[CheckInSchedule] Column missing, resetting ready state and retrying...", err);
            checkInScheduleReady = false;
            await ensureCheckInScheduleColumns();
            return await fn();
        }
        throw err;
    }
}

export async function getUserCheckInSchedule(userId: string): Promise<CheckInSchedule> {
    return runWithRetry(async () => {
        await ensureCheckInScheduleColumns();

        const rows = await prisma.$queryRaw<Array<{
            checkInDay: number | null;
            checkInFrequencyWeeks: number | null;
            checkInStartDate: Date | null;
        }>>`
            SELECT "checkInDay", "checkInFrequencyWeeks", "checkInStartDate"
            FROM "users"
            WHERE "id" = ${userId}
            LIMIT 1
        `;

        const row = rows[0];
        return {
            day: row?.checkInDay ?? null,
            frequencyWeeks: row?.checkInFrequencyWeeks ?? null,
            startDate: row?.checkInStartDate ? row.checkInStartDate.toISOString() : null,
        };
    });
}

export async function updateUserCheckInSchedule(userId: string, day: number, frequencyWeeks: number) {
    return runWithRetry(async () => {
        await ensureCheckInScheduleColumns();

        await prisma.$executeRaw`
            UPDATE "users"
            SET "checkInDay" = ${day},
                "checkInFrequencyWeeks" = ${frequencyWeeks},
                "checkInStartDate" = COALESCE("checkInStartDate", CURRENT_TIMESTAMP),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${userId}
        `;

        return getUserCheckInSchedule(userId);
    });
}

/** Normalize any Date/ISO to a stable noon Date for the app calendar day. */
export function toCheckInCalendarDate(input: Date | string = new Date()): Date {
    return parseLogDate(toDateKey(typeof input === "string" ? new Date(input) : input));
}

function startOfIsoWeek(date: Date) {
    const d = toCheckInCalendarDate(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function dateForWeekdayInIsoWeek(date: Date, day: number) {
    const monday = startOfIsoWeek(date);
    const offset = day === 0 ? 6 : day - 1;
    const due = new Date(monday);
    due.setDate(monday.getDate() + offset);
    return toCheckInCalendarDate(due);
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return toCheckInCalendarDate(next);
}

function daysBetween(a: Date, b: Date) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function getFirstEligibleDueDate(startDate: Date, day: number) {
    const earliestDueDate = addDays(toCheckInCalendarDate(startDate), 7);
    let candidate = dateForWeekdayInIsoWeek(earliestDueDate, day);

    if (candidate.getTime() < earliestDueDate.getTime()) {
        candidate = addDays(candidate, 7);
    }

    return candidate;
}

function emptyDueState(schedule: CheckInSchedule): CheckInDueState {
    return {
        ...schedule,
        isConfigured: false,
        isDueWeek: false,
        isDueToday: false,
        isOverdue: false,
        daysUntilNext: null,
        daysOverdue: null,
        nextDueDate: null,
        dueDayLabel: null,
        currentPeriodDueDate: null,
        outstandingWeekNumber: null,
    };
}

/**
 * Walk the fixed schedule forward from firstEligible by frequencyWeeks.
 * Does not drift based on submissions — missing a period never shifts later due dates.
 */
export function getScheduledDueDateOnOrBefore(
    firstEligible: Date,
    frequencyWeeks: number,
    today: Date
): Date | null {
    if (today.getTime() < firstEligible.getTime()) return null;

    const stepDays = frequencyWeeks * 7;
    let due = firstEligible;
    let next = addDays(due, stepDays);
    // Cap iterations (~4 years) for safety
    for (let i = 0; i < 220 && next.getTime() <= today.getTime(); i++) {
        due = next;
        next = addDays(due, stepDays);
    }
    return due;
}

export function getNextScheduledDueDateAfter(
    firstEligible: Date,
    frequencyWeeks: number,
    afterDate: Date
): Date {
    const stepDays = frequencyWeeks * 7;
    if (afterDate.getTime() < firstEligible.getTime()) {
        return firstEligible;
    }

    let due = firstEligible;
    for (let i = 0; i < 220; i++) {
        if (due.getTime() > afterDate.getTime()) return due;
        due = addDays(due, stepDays);
    }
    return due;
}

/**
 * Pure schedule status for a calendar day.
 *
 * Overdue spans week boundaries: if Saturday was missed and today is Monday,
 * the client stays overdue for that Saturday until they submit or the coach dismisses.
 * Next due dates stay on the fixed cadence (no drift from misses/dismissals).
 */
export function getCheckInDueState(schedule: CheckInSchedule, today = new Date()): CheckInDueState {
    const day = schedule.day;
    const frequencyWeeks = schedule.frequencyWeeks;
    const isConfigured = day !== null && day >= 0 && day <= 6 && !!frequencyWeeks && frequencyWeeks > 0;

    if (!isConfigured) {
        return emptyDueState(schedule);
    }

    const cleanToday = toCheckInCalendarDate(today);
    const cleanStartDate = schedule.startDate
        ? toCheckInCalendarDate(schedule.startDate)
        : cleanToday;
    const firstEligibleDueDate = getFirstEligibleDueDate(cleanStartDate, day);
    const dueDayLabel = CHECK_IN_DAYS[day];

    const mostRecentDue = getScheduledDueDateOnOrBefore(
        firstEligibleDueDate,
        frequencyWeeks,
        cleanToday
    );

    // Upcoming only — first due date is still in the future
    if (!mostRecentDue) {
        const nextDueDate = firstEligibleDueDate;
        return {
            ...schedule,
            isConfigured: true,
            isDueWeek: false,
            isDueToday: false,
            isOverdue: false,
            daysUntilNext: Math.max(0, daysBetween(cleanToday, nextDueDate)),
            daysOverdue: null,
            nextDueDate: nextDueDate.toISOString(),
            dueDayLabel,
            currentPeriodDueDate: null,
            outstandingWeekNumber: null,
        };
    }

    const isDueToday = mostRecentDue.getTime() === cleanToday.getTime();
    const isOverdue = mostRecentDue.getTime() < cleanToday.getTime();
    const nextAfterOutstanding = getNextScheduledDueDateAfter(
        firstEligibleDueDate,
        frequencyWeeks,
        mostRecentDue
    );
    // While due today, "next" is today; after that day (overdue or upcoming), next is the following slot.
    const nextDueDate = isDueToday ? mostRecentDue : nextAfterOutstanding;
    const daysUntilNext = Math.max(0, daysBetween(cleanToday, nextDueDate));
    const daysOverdue = isOverdue ? Math.max(1, daysBetween(mostRecentDue, cleanToday)) : null;

    return {
        ...schedule,
        isConfigured: true,
        isDueWeek: isDueToday || isOverdue,
        isDueToday,
        isOverdue,
        daysUntilNext,
        daysOverdue,
        nextDueDate: nextDueDate.toISOString(),
        dueDayLabel,
        currentPeriodDueDate: mostRecentDue.toISOString(),
        outstandingWeekNumber: getWeekNumber(mostRecentDue),
    };
}

/** True when a check-in row covers the outstanding schedule period. */
export function hasCheckInForOutstandingPeriod(
    dueState: Pick<CheckInDueState, "outstandingWeekNumber" | "isDueToday" | "isOverdue">,
    submittedWeekNumbers: Iterable<number>
): boolean {
    const week = dueState.outstandingWeekNumber;
    if (week == null) return false;
    if (!dueState.isDueToday && !dueState.isOverdue) return false;
    for (const n of submittedWeekNumbers) {
        if (n === week) return true;
    }
    return false;
}
