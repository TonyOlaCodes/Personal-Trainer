import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    dateKeyToUtcNoon,
    daysBetweenDateKeys,
    mondayOfDateKey,
    shiftAppDateKey,
} from "@/lib/appTimezone";
import { getWeekNumber, toDateKey } from "@/lib/utils";

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
    const schedules = await getUserCheckInSchedules([userId]);
    return schedules.get(userId) ?? { day: null, frequencyWeeks: null, startDate: null };
}

export async function getUserCheckInSchedules(
    userIds: string[]
): Promise<Map<string, CheckInSchedule>> {
    if (userIds.length === 0) return new Map();

    return runWithRetry(async () => {
        await ensureCheckInScheduleColumns();

        const rows = await prisma.$queryRaw<Array<{
            id: string;
            checkInDay: number | null;
            checkInFrequencyWeeks: number | null;
            checkInStartDate: Date | null;
        }>>`
            SELECT "id", "checkInDay", "checkInFrequencyWeeks", "checkInStartDate"
            FROM "users"
            WHERE "id" IN (${Prisma.join(userIds)})
        `;

        return new Map(
            rows.map((row) => [
                row.id,
                {
                    day: row.checkInDay ?? null,
                    frequencyWeeks: row.checkInFrequencyWeeks ?? null,
                    startDate: row.checkInStartDate ? row.checkInStartDate.toISOString() : null,
                },
            ])
        );
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

function dateKeyFromInput(input: Date | string): string {
    if (typeof input === "string") {
        const dateOnly = input.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateOnly && !input.includes("T")) {
            return dateOnly[1];
        }
        return toDateKey(new Date(input));
    }
    return toDateKey(input);
}

/**
 * Canonical check-in period key: YYYY-MM-DD in Europe/Dublin.
 * Use this for API payloads and check_in_requests.periodDueDateKey — never a raw ISO timestamp.
 */
export function canonicalPeriodDueDateKey(
    currentPeriodDueDate: string | Date | null | undefined
): string | null {
    if (currentPeriodDueDate == null || currentPeriodDueDate === "") return null;
    return dateKeyFromInput(currentPeriodDueDate);
}

/** Normalize any Date/ISO to UTC noon of the app (Europe/Dublin) calendar day. */
export function toCheckInCalendarDate(input: Date | string = new Date()): Date {
    return dateKeyToUtcNoon(dateKeyFromInput(input));
}

function startOfIsoWeek(date: Date) {
    return dateKeyToUtcNoon(mondayOfDateKey(toDateKey(date)));
}

function dateForWeekdayInIsoWeek(date: Date, day: number) {
    const mondayKey = mondayOfDateKey(toDateKey(date));
    const offset = day === 0 ? 6 : day - 1;
    return dateKeyToUtcNoon(shiftAppDateKey(mondayKey, offset));
}

function addDays(date: Date, days: number) {
    return dateKeyToUtcNoon(shiftAppDateKey(toDateKey(date), days));
}

function daysBetween(a: Date, b: Date) {
    return daysBetweenDateKeys(toDateKey(a), toDateKey(b));
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
    dueState: Pick<CheckInDueState, "outstandingWeekNumber" | "isDueToday" | "isOverdue" | "currentPeriodDueDate">,
    submittedWeekNumbers: Iterable<number>,
    submittedPeriodKeys?: Iterable<string | null | undefined>
): boolean {
    if (!dueState.isDueToday && !dueState.isOverdue) return false;
    const dueKey = canonicalPeriodDueDateKey(dueState.currentPeriodDueDate);
    if (dueKey && submittedPeriodKeys) {
        for (const key of submittedPeriodKeys) {
            if (key === dueKey) return true;
        }
    }
    const week = dueState.outstandingWeekNumber;
    if (week == null) return false;
    for (const n of submittedWeekNumbers) {
        if (n === week) return true;
    }
    return false;
}

type DuplicateCheckInRow = {
    id: string;
    status: string;
    coachResponse: string | null;
    coachVideoUrl: string | null;
    frontImageUrl: string | null;
    sideImageUrl: string | null;
    videoUrl: string | null;
    feedback: string | null;
    notes: string | null;
    bodyweightKg: number | null;
    createdAt: Date;
    lastUpdatedByClientAt: Date | null;
    respondedAt: Date | null;
};

function checkInMergeScore(row: DuplicateCheckInRow): number {
    let score = 0;
    if (row.status === "REVIEWED") score += 1000;
    if (row.coachResponse) score += 200;
    if (row.coachVideoUrl) score += 100;
    if (row.frontImageUrl) score += 40;
    if (row.sideImageUrl) score += 40;
    if (row.videoUrl) score += 40;
    if (row.feedback) score += 20;
    if (row.notes) score += 10;
    if (row.bodyweightKg != null) score += 10;
    return score;
}

/**
 * Merge historical duplicate (userId, weekNumber) rows, then add a unique index.
 * Keeps the richest reviewed/submitted row and copies missing coach/client fields
 * from extras. Does not delete unique period history.
 */
export async function ensureCheckInUserWeekUnique() {
    const groups = await prisma.$queryRaw<Array<{ userId: string; weekNumber: number; n: number }>>`
        SELECT "userId", "weekNumber", COUNT(*)::int AS n
        FROM "check_ins"
        GROUP BY "userId", "weekNumber"
        HAVING COUNT(*) > 1
    `;

    for (const group of groups) {
        const rows = await prisma.checkIn.findMany({
            where: { userId: group.userId, weekNumber: group.weekNumber },
            orderBy: [{ createdAt: "desc" }],
        });
        if (rows.length < 2) continue;

        const ranked = [...rows].sort((a, b) => {
            const scoreDiff = checkInMergeScore(b) - checkInMergeScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            const aUpdated = a.lastUpdatedByClientAt?.getTime() ?? a.createdAt.getTime();
            const bUpdated = b.lastUpdatedByClientAt?.getTime() ?? b.createdAt.getTime();
            return bUpdated - aUpdated;
        });
        const keeper = ranked[0];
        const extras = ranked.slice(1);

        const merged = {
            coachResponse: keeper.coachResponse,
            coachVideoUrl: keeper.coachVideoUrl,
            frontImageUrl: keeper.frontImageUrl,
            sideImageUrl: keeper.sideImageUrl,
            videoUrl: keeper.videoUrl,
            feedback: keeper.feedback,
            notes: keeper.notes,
            bodyweightKg: keeper.bodyweightKg,
            status: keeper.status,
            respondedAt: keeper.respondedAt,
            lastUpdatedByClientAt: keeper.lastUpdatedByClientAt,
            coachLastSeenAt: keeper.coachLastSeenAt,
        };

        for (const extra of extras) {
            if (!merged.coachResponse && extra.coachResponse) merged.coachResponse = extra.coachResponse;
            if (!merged.coachVideoUrl && extra.coachVideoUrl) merged.coachVideoUrl = extra.coachVideoUrl;
            if (!merged.frontImageUrl && extra.frontImageUrl) merged.frontImageUrl = extra.frontImageUrl;
            if (!merged.sideImageUrl && extra.sideImageUrl) merged.sideImageUrl = extra.sideImageUrl;
            if (!merged.videoUrl && extra.videoUrl) merged.videoUrl = extra.videoUrl;
            if (!merged.feedback && extra.feedback) merged.feedback = extra.feedback;
            if (!merged.notes && extra.notes) merged.notes = extra.notes;
            if (merged.bodyweightKg == null && extra.bodyweightKg != null) merged.bodyweightKg = extra.bodyweightKg;
            if (merged.status !== "REVIEWED" && extra.status === "REVIEWED") merged.status = extra.status;
            if (!merged.respondedAt && extra.respondedAt) merged.respondedAt = extra.respondedAt;
            if (
                extra.lastUpdatedByClientAt
                && (!merged.lastUpdatedByClientAt || extra.lastUpdatedByClientAt > merged.lastUpdatedByClientAt)
            ) {
                merged.lastUpdatedByClientAt = extra.lastUpdatedByClientAt;
            }
            if (
                extra.coachLastSeenAt
                && (!merged.coachLastSeenAt || extra.coachLastSeenAt > merged.coachLastSeenAt)
            ) {
                merged.coachLastSeenAt = extra.coachLastSeenAt;
            }
        }

        await prisma.checkIn.update({
            where: { id: keeper.id },
            data: merged,
        });
        await prisma.checkIn.deleteMany({
            where: { id: { in: extras.map((row) => row.id) } },
        });
        console.warn(
            `[CheckInUniqueness] Merged ${extras.length} duplicate check-in(s) into ${keeper.id} for user ${group.userId} week ${group.weekNumber}`
        );
    }

    await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "check_ins_userId_weekNumber_key"
        ON "check_ins"("userId", "weekNumber")
    `;
}

/**
 * Canonical uniqueness is (userId, periodDueDateKey).
 * Backfills due-date keys from the client's schedule, then replaces week uniqueness.
 */
export async function ensureCheckInPeriodDueDateUnique() {
    await prisma.$executeRaw`
        ALTER TABLE "check_ins"
        ADD COLUMN IF NOT EXISTS "periodDueDateKey" TEXT
    `;

    const missing = await prisma.$queryRaw<Array<{
        id: string;
        userId: string;
        weekNumber: number;
        createdAt: Date;
    }>>`
        SELECT "id", "userId", "weekNumber", "createdAt"
        FROM "check_ins"
        WHERE "periodDueDateKey" IS NULL
    `;

    if (missing.length > 0) {
        const userIds = [...new Set(missing.map((row) => row.userId))];
        const schedules = await getUserCheckInSchedules(userIds);
        const { scheduledPeriodContainingDate } = await import("@/lib/checkInPeriods");

        for (const row of missing) {
            const createdKey = toDateKey(row.createdAt);
            const schedule = schedules.get(row.userId);
            const period = schedule
                ? scheduledPeriodContainingDate(schedule, createdKey, createdKey)
                : null;
            const dueKey = period?.dueDateKey ?? createdKey;
            await prisma.$executeRaw`
                UPDATE "check_ins"
                SET "periodDueDateKey" = ${dueKey}
                WHERE "id" = ${row.id} AND "periodDueDateKey" IS NULL
            `;
        }
    }

    const groups = await prisma.$queryRaw<Array<{ userId: string; periodDueDateKey: string; n: number }>>`
        SELECT "userId", "periodDueDateKey", COUNT(*)::int AS n
        FROM "check_ins"
        WHERE "periodDueDateKey" IS NOT NULL
        GROUP BY "userId", "periodDueDateKey"
        HAVING COUNT(*) > 1
    `;

    for (const group of groups) {
        const rows = await prisma.checkIn.findMany({
            where: { userId: group.userId, periodDueDateKey: group.periodDueDateKey },
            orderBy: [{ createdAt: "desc" }],
        });
        if (rows.length < 2) continue;

        const ranked = [...rows].sort((a, b) => {
            const scoreDiff = checkInMergeScore(b) - checkInMergeScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            const aUpdated = a.lastUpdatedByClientAt?.getTime() ?? a.createdAt.getTime();
            const bUpdated = b.lastUpdatedByClientAt?.getTime() ?? b.createdAt.getTime();
            return bUpdated - aUpdated;
        });
        const keeper = ranked[0];
        const extras = ranked.slice(1);
        const merged = {
            coachResponse: keeper.coachResponse,
            coachVideoUrl: keeper.coachVideoUrl,
            frontImageUrl: keeper.frontImageUrl,
            sideImageUrl: keeper.sideImageUrl,
            videoUrl: keeper.videoUrl,
            feedback: keeper.feedback,
            notes: keeper.notes,
            bodyweightKg: keeper.bodyweightKg,
            status: keeper.status,
            respondedAt: keeper.respondedAt,
            lastUpdatedByClientAt: keeper.lastUpdatedByClientAt,
            coachLastSeenAt: keeper.coachLastSeenAt,
        };

        for (const extra of extras) {
            if (!merged.coachResponse && extra.coachResponse) merged.coachResponse = extra.coachResponse;
            if (!merged.coachVideoUrl && extra.coachVideoUrl) merged.coachVideoUrl = extra.coachVideoUrl;
            if (!merged.frontImageUrl && extra.frontImageUrl) merged.frontImageUrl = extra.frontImageUrl;
            if (!merged.sideImageUrl && extra.sideImageUrl) merged.sideImageUrl = extra.sideImageUrl;
            if (!merged.videoUrl && extra.videoUrl) merged.videoUrl = extra.videoUrl;
            if (!merged.feedback && extra.feedback) merged.feedback = extra.feedback;
            if (!merged.notes && extra.notes) merged.notes = extra.notes;
            if (merged.bodyweightKg == null && extra.bodyweightKg != null) merged.bodyweightKg = extra.bodyweightKg;
            if (merged.status !== "REVIEWED" && extra.status === "REVIEWED") merged.status = extra.status;
            if (!merged.respondedAt && extra.respondedAt) merged.respondedAt = extra.respondedAt;
            if (
                extra.lastUpdatedByClientAt
                && (!merged.lastUpdatedByClientAt || extra.lastUpdatedByClientAt > merged.lastUpdatedByClientAt)
            ) {
                merged.lastUpdatedByClientAt = extra.lastUpdatedByClientAt;
            }
            if (
                extra.coachLastSeenAt
                && (!merged.coachLastSeenAt || extra.coachLastSeenAt > merged.coachLastSeenAt)
            ) {
                merged.coachLastSeenAt = extra.coachLastSeenAt;
            }
        }

        await prisma.checkIn.update({
            where: { id: keeper.id },
            data: merged,
        });
        await prisma.checkIn.deleteMany({
            where: { id: { in: extras.map((row) => row.id) } },
        });
        console.warn(
            `[CheckInUniqueness] Merged ${extras.length} duplicate check-in(s) into ${keeper.id} for user ${group.userId} period ${group.periodDueDateKey}`
        );
    }

    await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "check_ins_userId_periodDueDateKey_key"
        ON "check_ins"("userId", "periodDueDateKey")
        WHERE "periodDueDateKey" IS NOT NULL
    `;
    await prisma.$executeRaw`
        DROP INDEX IF EXISTS "check_ins_userId_weekNumber_key"
    `;
}
