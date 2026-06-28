import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import type { CheckInDueState } from "@/lib/checkInSchedule";
import { getWeekNumber, parseLogDate } from "@/lib/utils";

function ordinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

/** e.g. "29th June" (adds year when not the current year). */
export function formatDayMonthLabel(input: Date | string): string {
    const d = input instanceof Date ? input : parseLogDate(String(input).split("T")[0]);
    const { dateKey } = getLocalTimeParts(d, APP_TIMEZONE);
    const [y, , day] = dateKey.split("-").map(Number);
    const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: APP_TIMEZONE }).format(d);
    const nowYear = Number(getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey.split("-")[0]);
    const yearSuffix = y !== nowYear ? ` ${y}` : "";
    return `${day}${ordinalSuffix(day)} ${month}${yearSuffix}`;
}

export function getIsoWeekYear(date = new Date()): number {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    return d.getFullYear();
}

/** Monday at the start of an ISO week. */
export function getIsoWeekStartDate(weekNumber: number, isoWeekYear: number): Date {
    const jan4 = new Date(isoWeekYear, 0, 4, 12, 0, 0, 0);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (day - 1));
    monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
    return monday;
}

export function formatCheckInWeekLabel(weekNumber: number, isoWeekYear?: number): string {
    const year = isoWeekYear ?? getIsoWeekYear(new Date());
    return formatDayMonthLabel(getIsoWeekStartDate(weekNumber, year));
}

export function formatCheckInWeekFromCheckIn(checkIn: { weekNumber: number; createdAt: string | Date }): string {
    return formatCheckInWeekLabel(checkIn.weekNumber, getIsoWeekYear(new Date(checkIn.createdAt)));
}

export function formatCheckInWeekFromDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return formatCheckInWeekLabel(getWeekNumber(d), getIsoWeekYear(d));
}

export function formatCheckInDueDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    return formatDayMonthLabel(iso);
}

export function formatCheckInPeriodTitle(
    weekNumber: number,
    createdAt?: string | Date
): string {
    const label = createdAt
        ? formatCheckInWeekFromCheckIn({ weekNumber, createdAt })
        : formatCheckInWeekLabel(weekNumber);
    return `${label} check-in`;
}

/** Compact label for list badges, e.g. "29 Jun". */
export function formatCheckInWeekShort(weekNumber: number, isoWeekYear?: number): string {
    const d = getIsoWeekStartDate(weekNumber, isoWeekYear ?? getIsoWeekYear(new Date()));
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: APP_TIMEZONE,
    }).format(d);
}

export function formatCheckInWeekShortFromCheckIn(checkIn: { weekNumber: number; createdAt: string | Date }): string {
    return formatCheckInWeekShort(checkIn.weekNumber, getIsoWeekYear(new Date(checkIn.createdAt)));
}

export function formatCheckInDueSubtitle(
    dueState: Pick<
        CheckInDueState,
        "isConfigured" | "isDueToday" | "isOverdue" | "daysUntilNext" | "currentPeriodDueDate" | "nextDueDate"
    >
): string {
    if (!dueState.isConfigured) {
        return "No check-in due — your coach hasn't set a schedule yet";
    }

    const periodDate = formatCheckInDueDate(dueState.currentPeriodDueDate);
    const nextDate = formatCheckInDueDate(dueState.nextDueDate);

    if (dueState.isOverdue && periodDate) return `Check-in overdue · due ${periodDate}`;
    if (dueState.isDueToday && periodDate) return `Check-in due · ${periodDate}`;
    if (dueState.daysUntilNext === 1 && nextDate) return `Next check-in tomorrow · ${nextDate}`;
    if (dueState.daysUntilNext != null && dueState.daysUntilNext > 0 && nextDate) {
        return `Next check-in · ${nextDate} (in ${dueState.daysUntilNext} days)`;
    }
    if (nextDate) return `Next check-in · ${nextDate}`;
    return "No check-in due";
}
