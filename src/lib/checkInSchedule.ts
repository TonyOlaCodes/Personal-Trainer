import { prisma } from "@/lib/prisma";

export interface CheckInSchedule {
    day: number | null;
    frequencyWeeks: number | null;
    startDate: string | null;
}

export interface CheckInDueState extends CheckInSchedule {
    isConfigured: boolean;
    isDueWeek: boolean;
    isDueToday: boolean;
    isOverdue: boolean;
    daysUntilNext: number | null;
    nextDueDate: string | null;
    dueDayLabel: string | null;
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

export async function getUserCheckInSchedule(userId: string): Promise<CheckInSchedule> {
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
}

export async function updateUserCheckInSchedule(userId: string, day: number, frequencyWeeks: number) {
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
}

function startOfIsoWeek(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
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
    return due;
}

function weeksBetween(start: Date, end: Date) {
    const startWeek = startOfIsoWeek(start);
    const endWeek = startOfIsoWeek(end);
    return Math.floor((endWeek.getTime() - startWeek.getTime()) / (7 * 86400000));
}

export function getCheckInDueState(schedule: CheckInSchedule, today = new Date()): CheckInDueState {
    const day = schedule.day;
    const frequencyWeeks = schedule.frequencyWeeks;
    const isConfigured = day !== null && day >= 0 && day <= 6 && !!frequencyWeeks && frequencyWeeks > 0;

    if (!isConfigured) {
        return {
            ...schedule,
            isConfigured: false,
            isDueWeek: false,
            isDueToday: false,
            isOverdue: false,
            daysUntilNext: null,
            nextDueDate: null,
            dueDayLabel: null,
        };
    }

    const startDate = schedule.startDate ? new Date(schedule.startDate) : today;
    const cleanStartDate = new Date(startDate);
    cleanStartDate.setHours(0, 0, 0, 0);
    const cleanToday = new Date(today);
    cleanToday.setHours(0, 0, 0, 0);

    const elapsedWeeks = weeksBetween(startDate, cleanToday);
    const dueDateThisWeek = dateForWeekdayInIsoWeek(cleanToday, day);
    const dueDateAlreadyPassedWhenScheduleStarted = elapsedWeeks === 0 && dueDateThisWeek.getTime() < cleanStartDate.getTime();
    const isDueWeek = elapsedWeeks >= 0 && elapsedWeeks % frequencyWeeks === 0 && !dueDateAlreadyPassedWhenScheduleStarted;
    const isDueToday = isDueWeek && cleanToday.getTime() === dueDateThisWeek.getTime();
    const isOverdue = isDueWeek && cleanToday.getTime() > dueDateThisWeek.getTime();

    let nextDueDate = dueDateThisWeek;
    if (!isDueWeek || cleanToday.getTime() > dueDateThisWeek.getTime()) {
        for (let i = 1; i <= 60; i++) {
            const candidate = new Date(dueDateThisWeek);
            candidate.setDate(dueDateThisWeek.getDate() + i * 7);
            const candidateWeeks = weeksBetween(startDate, candidate);
            if (candidateWeeks >= 0 && candidateWeeks % frequencyWeeks === 0) {
                nextDueDate = candidate;
                break;
            }
        }
    }

    const daysUntilNext = Math.max(0, Math.ceil((nextDueDate.getTime() - cleanToday.getTime()) / 86400000));

    return {
        ...schedule,
        isConfigured: true,
        isDueWeek,
        isDueToday,
        isOverdue,
        daysUntilNext,
        nextDueDate: nextDueDate.toISOString(),
        dueDayLabel: CHECK_IN_DAYS[day],
    };
}
