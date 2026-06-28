import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
    getCheckInDueState,
    type CheckInDueState,
    type CheckInSchedule,
} from "@/lib/checkInSchedule";
import { getWeekNumber } from "@/lib/utils";

export type CoachAttentionActionType = "dismissed" | "excused";

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
    weekNumber: number
): boolean {
    const key = buildCheckInAlertKey(clientId, weekNumber);
    return actions.get(key)?.action === "dismissed";
}

/** Client-facing: overdue/due-week check-in hidden after coach dismisses for that week. */
export function applyCheckInAttentionOverrides(
    dueState: CheckInDueState,
    clientActions: CoachAttentionActionRow[],
    weekNumber: number,
    today = new Date()
): CheckInDueState {
    const dismissed = clientActions.some(
        (row) =>
            (row.category === "check_in_overdue" || row.category === "check_in_missed")
            && row.action === "dismissed"
            && row.weekNumber === weekNumber
    );

    if (!dismissed || !dueState.isConfigured) return dueState;
    if (!dueState.isOverdue && !dueState.isDueToday && !dueState.isDueWeek) return dueState;

    const schedule: CheckInSchedule = {
        day: dueState.day,
        frequencyWeeks: dueState.frequencyWeeks,
        startDate: dueState.startDate,
    };

    for (let offset = 1; offset <= 12; offset++) {
        const candidate = new Date(today);
        candidate.setDate(candidate.getDate() + offset * 7);
        const next = getCheckInDueState(schedule, candidate);
        if (next.isDueWeek && next.nextDueDate) {
            return {
                ...dueState,
                isDueWeek: false,
                isDueToday: false,
                isOverdue: false,
                daysUntilNext: next.daysUntilNext,
                nextDueDate: next.nextDueDate,
                dueDayLabel: next.dueDayLabel,
            };
        }
    }

    return {
        ...dueState,
        isDueWeek: false,
        isDueToday: false,
        isOverdue: false,
    };
}

export async function getEffectiveCheckInDueStateForUser(
    userId: string,
    schedule: CheckInSchedule,
    today = new Date()
): Promise<CheckInDueState> {
    const dueState = getCheckInDueState(schedule, today);
    const weekNumber = getWeekNumber(today);
    const clientActions = await getClientAttentionActions(userId);
    return applyCheckInAttentionOverrides(dueState, clientActions, weekNumber, today);
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
