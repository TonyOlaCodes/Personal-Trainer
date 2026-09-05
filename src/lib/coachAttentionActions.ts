import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
    getCheckInDueState,
    getFirstEligibleDueDate,
    getNextScheduledDueDateAfter,
    getUserCheckInSchedules,
    toCheckInCalendarDate,
    type CheckInDueState,
    type CheckInSchedule,
} from "@/lib/checkInSchedule";
import { getWeekNumber } from "@/lib/utils";

export type CoachAttentionActionType = "dismissed" | "excused";

/** No app activity for this many days — client treated as inactive for dismiss snooze. */
export const CLIENT_APP_INACTIVE_DAYS = 10;

/** Inactive-client dismisses on needs-attention reappear after this many days. */
export const INACTIVE_CLIENT_DISMISS_SNOOZE_DAYS = 3;

export type CoachAttentionCategory =
    | "missed_workout"
    | "check_in_overdue"
    | "check_in_missed"
    | "pending_check_in"
    | "unread_message"
    | "setup_needed"
    | "falling_behind";

export interface CoachAttentionActionRow {
    alertKey: string;
    action: CoachAttentionActionType;
    clientId: string;
    category: CoachAttentionCategory;
    weekNumber: number | null;
    dateKey: string | null;
    workoutId: string | null;
    createdAt: Date;
}

let tableReady = false;

export async function ensureCoachAttentionActionsTable() {
    if (tableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "coach_attention_actions" (
            "id" TEXT PRIMARY KEY,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "clientId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "alertKey" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "category" TEXT NOT NULL,
            "weekNumber" INTEGER,
            "dateKey" TEXT,
            "workoutId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("coachId", "alertKey")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "coach_attention_actions_client_idx"
        ON "coach_attention_actions"("clientId")
    `;

    tableReady = true;
}

export function buildMissedWorkoutAlertKey(clientId: string, dateKey: string, workoutId: string) {
    return `missed-workout:${clientId}:${dateKey}:${workoutId}`;
}

export function buildCheckInAlertKey(clientId: string, weekNumber: number) {
    return `check-in:${clientId}:${weekNumber}`;
}

export function buildPendingReviewAlertKey(checkInId: string) {
    return `pending-review:${checkInId}`;
}

export function buildUnreadMessageAlertKey(clientId: string) {
    return `unread-message:${clientId}`;
}

export function buildSetupNeededAlertKey(clientId: string) {
    return `setup-needed:${clientId}`;
}

export function buildFallingBehindAlertKey(clientId: string, weekNumber: number) {
    return `falling-behind:${clientId}:${weekNumber}`;
}

export async function getCoachAttentionActions(coachId: string): Promise<Map<string, CoachAttentionActionRow>> {
    await ensureCoachAttentionActionsTable();

    const rows = await prisma.$queryRaw<CoachAttentionActionRow[]>`
        SELECT "alertKey", "action", "clientId", "category", "weekNumber", "dateKey", "workoutId", "createdAt"
        FROM "coach_attention_actions"
        WHERE "coachId" = ${coachId}
    `;

    return new Map(rows.map((row) => [row.alertKey, row]));
}

export async function getClientAttentionActions(clientId: string): Promise<CoachAttentionActionRow[]> {
    const byUser = await getClientAttentionActionsForUsers([clientId]);
    return byUser.get(clientId) ?? [];
}

export async function getClientAttentionActionsForUsers(
    clientIds: string[]
): Promise<Map<string, CoachAttentionActionRow[]>> {
    await ensureCoachAttentionActionsTable();
    const byUser = new Map<string, CoachAttentionActionRow[]>();
    if (clientIds.length === 0) return byUser;

    const rows = await prisma.$queryRaw<CoachAttentionActionRow[]>`
        SELECT "alertKey", "action", "clientId", "category", "weekNumber", "dateKey", "workoutId", "createdAt"
        FROM "coach_attention_actions"
        WHERE "clientId" IN (${Prisma.join(clientIds)})
    `;

    for (const row of rows) {
        const existing = byUser.get(row.clientId) ?? [];
        existing.push(row);
        byUser.set(row.clientId, existing);
    }
    return byUser;
}

export async function setCoachAttentionAction(input: {
    coachId: string;
    clientId: string;
    alertKey: string;
    action: CoachAttentionActionType;
    category: CoachAttentionCategory;
    weekNumber?: number | null;
    dateKey?: string | null;
    workoutId?: string | null;
}) {
    await ensureCoachAttentionActionsTable();

    await prisma.$executeRaw`
        INSERT INTO "coach_attention_actions"
            ("id", "coachId", "clientId", "alertKey", "action", "category", "weekNumber", "dateKey", "workoutId")
        VALUES
            (${randomUUID()}, ${input.coachId}, ${input.clientId}, ${input.alertKey}, ${input.action},
             ${input.category}, ${input.weekNumber ?? null}, ${input.dateKey ?? null}, ${input.workoutId ?? null})
        ON CONFLICT ("coachId", "alertKey") DO UPDATE SET
            "action" = EXCLUDED."action",
            "category" = EXCLUDED."category",
            "weekNumber" = EXCLUDED."weekNumber",
            "dateKey" = EXCLUDED."dateKey",
            "workoutId" = EXCLUDED."workoutId",
            "createdAt" = CURRENT_TIMESTAMP
    `;
}

export async function removeCoachAttentionAction(coachId: string, alertKey: string) {
    await ensureCoachAttentionActionsTable();
    await prisma.$executeRaw`
        DELETE FROM "coach_attention_actions"
        WHERE "coachId" = ${coachId} AND "alertKey" = ${alertKey}
    `;
}

export function isMissedWorkoutExcused(
    actions: Map<string, CoachAttentionActionRow>,
    clientId: string,
    dateKey: string,
    workoutId: string
): boolean {
    const key = buildMissedWorkoutAlertKey(clientId, dateKey, workoutId);
    return actions.get(key)?.action === "excused";
}

export function isCheckInAlertDismissed(
    actions: Map<string, CoachAttentionActionRow>,
    clientId: string,
    weekNumber: number,
    clientLastActiveAt?: Date | null,
    now = new Date()
): boolean {
    const key = buildCheckInAlertKey(clientId, weekNumber);
    return isDismissedAlertCurrentlyHidden(actions.get(key), clientLastActiveAt, now);
}

export function isClientInactiveOnApp(
    lastActiveAt: Date | null | undefined,
    now = new Date()
): boolean {
    if (!lastActiveAt) return true;
    const cutoff = now.getTime() - CLIENT_APP_INACTIVE_DAYS * 86400000;
    return lastActiveAt.getTime() < cutoff;
}

/** True when a dismissed alert should stay hidden (permanent for active clients, 3d snooze if inactive). */
export function isDismissedAlertCurrentlyHidden(
    action: CoachAttentionActionRow | undefined,
    clientLastActiveAt: Date | null | undefined,
    now = new Date()
): boolean {
    if (!action || action.action !== "dismissed") return false;

    if (isClientInactiveOnApp(clientLastActiveAt, now)) {
        const dismissedAt = new Date(action.createdAt).getTime();
        if (Number.isNaN(dismissedAt)) return false;
        const snoozeMs = INACTIVE_CLIENT_DISMISS_SNOOZE_DAYS * 86400000;
        return now.getTime() - dismissedAt < snoozeMs;
    }

    return true;
}

/**
 * Clear due/overdue flags and surface the next scheduled due date (fixed cadence).
 * Used after dismiss or after the client submits for the outstanding period.
 */
export function clearOutstandingCheckInPeriod(
    dueState: CheckInDueState,
    today = new Date()
): CheckInDueState {
    if (!dueState.isConfigured) return dueState;
    if (!dueState.isOverdue && !dueState.isDueToday && !dueState.isDueWeek) return dueState;

    const cleanToday = toCheckInCalendarDate(today);
    const frequencyWeeks = dueState.frequencyWeeks ?? 1;
    const day = dueState.day;
    let nextDue: Date | null = dueState.nextDueDate ? toCheckInCalendarDate(dueState.nextDueDate) : null;

    if (day != null && day >= 0 && day <= 6) {
        const start = dueState.startDate
            ? toCheckInCalendarDate(dueState.startDate)
            : cleanToday;
        const firstEligible = getFirstEligibleDueDate(start, day);
        const after = dueState.currentPeriodDueDate
            ? toCheckInCalendarDate(dueState.currentPeriodDueDate)
            : cleanToday;
        nextDue = getNextScheduledDueDateAfter(firstEligible, frequencyWeeks, after);
    }

    const daysUntilNext = nextDue
        ? Math.max(0, Math.round((nextDue.getTime() - cleanToday.getTime()) / 86400000))
        : dueState.daysUntilNext;

    return {
        ...dueState,
        isDueWeek: false,
        isDueToday: false,
        isOverdue: false,
        daysOverdue: null,
        currentPeriodDueDate: null,
        outstandingWeekNumber: null,
        daysUntilNext,
        nextDueDate: nextDue?.toISOString() ?? dueState.nextDueDate,
        dueDayLabel: dueState.dueDayLabel,
    };
}

/**
 * Client-facing: overdue/due check-in hidden after coach dismisses that outstanding period.
 * Uses the period's week number (not "today's" week) so a Monday dismiss of Saturday's miss sticks.
 */
export function applyCheckInAttentionOverrides(
    dueState: CheckInDueState,
    clientActions: CoachAttentionActionRow[],
    clientId: string,
    weekNumber: number,
    today = new Date(),
    clientLastActiveAt: Date | null | undefined = null
): CheckInDueState {
    const periodWeek = dueState.outstandingWeekNumber ?? weekNumber;
    const alertKey = buildCheckInAlertKey(clientId, periodWeek);
    const dismissRow =
        clientActions.find(
            (row) => row.alertKey === alertKey && row.action === "dismissed"
        )
        ?? clientActions.find(
            (row) =>
                (row.category === "check_in_overdue" || row.category === "check_in_missed")
                && row.action === "dismissed"
                && row.weekNumber === periodWeek
        );
    const dismissed = dismissRow
        ? isDismissedAlertCurrentlyHidden(dismissRow, clientLastActiveAt, today)
        : false;

    if (!dismissed) return dueState;
    return clearOutstandingCheckInPeriod(dueState, today);
}

/** Apply dismiss overrides and clear the period when a covering check-in exists. */
export function finalizeEffectiveCheckInDueState(
    dueState: CheckInDueState,
    clientActions: CoachAttentionActionRow[],
    userId: string,
    today: Date,
    lastActiveAt: Date | null | undefined,
    hasPeriodCheckIn: boolean
): CheckInDueState {
    const weekNumber = dueState.outstandingWeekNumber ?? getWeekNumber(today);
    let effective = applyCheckInAttentionOverrides(
        dueState,
        clientActions,
        userId,
        weekNumber,
        today,
        lastActiveAt
    );

    if (
        hasPeriodCheckIn
        && (effective.isOverdue || effective.isDueToday || effective.isDueWeek)
    ) {
        effective = clearOutstandingCheckInPeriod(effective, today);
    }

    return effective;
}

export async function getEffectiveCheckInDueStateForUser(
    userId: string,
    schedule: CheckInSchedule,
    today = new Date()
): Promise<CheckInDueState> {
    const dueState = getCheckInDueState(schedule, today);
    const [clientActions, user, periodCheckIn] = await Promise.all([
        getClientAttentionActions(userId),
        prisma.user.findUnique({
            where: { id: userId },
            select: { lastActiveAt: true },
        }),
        dueState.outstandingWeekNumber != null
            ? prisma.checkIn.findFirst({
                where: { userId, weekNumber: dueState.outstandingWeekNumber },
                select: { id: true },
            })
            : Promise.resolve(null),
    ]);

    return finalizeEffectiveCheckInDueState(
        dueState,
        clientActions,
        userId,
        today,
        user?.lastActiveAt ?? null,
        Boolean(periodCheckIn)
    );
}

/** Same as getEffectiveCheckInDueStateForUser, batched for coach lists. */
export async function getEffectiveCheckInDueStatesForUsers(
    userIds: string[],
    today = new Date()
): Promise<Map<string, CheckInDueState>> {
    const result = new Map<string, CheckInDueState>();
    if (userIds.length === 0) return result;

    const [schedules, actionsByUser, users] = await Promise.all([
        getUserCheckInSchedules(userIds),
        getClientAttentionActionsForUsers(userIds),
        prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, lastActiveAt: true },
        }),
    ]);
    const lastActiveByUser = new Map(users.map((user) => [user.id, user.lastActiveAt]));

    const pending = userIds.map((userId) => {
        const schedule = schedules.get(userId) ?? { day: null, frequencyWeeks: null, startDate: null };
        return {
            userId,
            dueState: getCheckInDueState(schedule, today),
            actions: actionsByUser.get(userId) ?? [],
        };
    });

    const periodFilters = pending
        .filter((row) => row.dueState.outstandingWeekNumber != null)
        .map((row) => ({
            userId: row.userId,
            weekNumber: row.dueState.outstandingWeekNumber as number,
        }));

    const periodCheckIns = periodFilters.length > 0
        ? await prisma.checkIn.findMany({
            where: { OR: periodFilters },
            select: { userId: true, weekNumber: true },
        })
        : [];
    const coveredPeriods = new Set(
        periodCheckIns.map((row) => `${row.userId}:${row.weekNumber}`)
    );

    for (const row of pending) {
        const hasPeriodCheckIn = row.dueState.outstandingWeekNumber != null
            && coveredPeriods.has(`${row.userId}:${row.dueState.outstandingWeekNumber}`);
        result.set(
            row.userId,
            finalizeEffectiveCheckInDueState(
                row.dueState,
                row.actions,
                row.userId,
                today,
                lastActiveByUser.get(row.userId) ?? null,
                hasPeriodCheckIn
            )
        );
    }

    return result;
}

export function getExcusedMissedWorkoutKeys(clientActions: CoachAttentionActionRow[]): Set<string> {
    const keys = new Set<string>();
    for (const row of clientActions) {
        if (row.category !== "missed_workout" || row.action !== "excused") continue;
        if (!row.dateKey || !row.workoutId) continue;
        keys.add(`${row.dateKey}:${row.workoutId}`);
    }
    return keys;
}

export function getExcusedMissedWorkoutKeysForClient(
    actions: Map<string, CoachAttentionActionRow> | CoachAttentionActionRow[],
    clientId: string
): string[] {
    const rows = actions instanceof Map
        ? [...actions.values()].filter((row) => row.clientId === clientId)
        : actions.filter((row) => row.clientId === clientId);
    return [...getExcusedMissedWorkoutKeys(rows)];
}
