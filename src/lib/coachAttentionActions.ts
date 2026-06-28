import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
    getCheckInDueState,
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
    await ensureCoachAttentionActionsTable();

    return prisma.$queryRaw<CoachAttentionActionRow[]>`
        SELECT "alertKey", "action", "clientId", "category", "weekNumber", "dateKey", "workoutId", "createdAt"
        FROM "coach_attention_actions"
        WHERE "clientId" = ${clientId}
    `;
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

/** Client-facing: overdue/due-week check-in hidden after coach dismisses for that week. */
export function applyCheckInAttentionOverrides(
    dueState: CheckInDueState,
    clientActions: CoachAttentionActionRow[],
    clientId: string,
    weekNumber: number,
    today = new Date(),
    clientLastActiveAt: Date | null | undefined = null
): CheckInDueState {
    const alertKey = buildCheckInAlertKey(clientId, weekNumber);
    const dismissRow =
        clientActions.find(
            (row) => row.alertKey === alertKey && row.action === "dismissed"
        )
        ?? clientActions.find(
            (row) =>
                (row.category === "check_in_overdue" || row.category === "check_in_missed")
                && row.action === "dismissed"
                && row.weekNumber === weekNumber
        );
    const dismissed = dismissRow
        ? isDismissedAlertCurrentlyHidden(dismissRow, clientLastActiveAt, today)
        : false;

    if (!dismissed || !dueState.isConfigured) return dueState;
    if (!dueState.isOverdue && !dueState.isDueToday && !dueState.isDueWeek) return dueState;

    // When overdue, getCheckInDueState already computed daysUntilNext for the next cycle.
    if (dueState.isOverdue && dueState.daysUntilNext != null) {
        return {
            ...dueState,
            isDueWeek: false,
            isDueToday: false,
            isOverdue: false,
        };
    }

    const schedule: CheckInSchedule = {
        day: dueState.day,
        frequencyWeeks: dueState.frequencyWeeks,
        startDate: dueState.startDate,
    };
    const freqWeeks = dueState.frequencyWeeks ?? 1;
    const probe = new Date(today);
    probe.setDate(probe.getDate() + freqWeeks * 7);
    const nextState = getCheckInDueState(schedule, probe);

    const cleanToday = new Date(today);
    cleanToday.setHours(0, 0, 0, 0);
    const nextDue = nextState.nextDueDate ? new Date(nextState.nextDueDate) : probe;
    nextDue.setHours(0, 0, 0, 0);
    const daysUntilNext = Math.max(0, Math.ceil((nextDue.getTime() - cleanToday.getTime()) / 86400000));

    return {
        ...dueState,
        isDueWeek: false,
        isDueToday: false,
        isOverdue: false,
        daysUntilNext,
        nextDueDate: nextState.nextDueDate,
        dueDayLabel: nextState.dueDayLabel,
    };
}

export async function getEffectiveCheckInDueStateForUser(
    userId: string,
    schedule: CheckInSchedule,
    today = new Date()
): Promise<CheckInDueState> {
    const dueState = getCheckInDueState(schedule, today);
    const weekNumber = getWeekNumber(today);
    const [clientActions, user] = await Promise.all([
        getClientAttentionActions(userId),
        prisma.user.findUnique({
            where: { id: userId },
            select: { lastActiveAt: true },
        }),
    ]);
    return applyCheckInAttentionOverrides(
        dueState,
        clientActions,
        userId,
        weekNumber,
        today,
        user?.lastActiveAt ?? null
    );
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
