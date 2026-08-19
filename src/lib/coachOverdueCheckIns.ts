import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import {
    getCheckInDueState,
    getUserCheckInSchedule,
    hasCheckInForOutstandingPeriod,
    type CheckInDueState,
    type CheckInSchedule,
} from "@/lib/checkInSchedule";
import {
    applyCheckInAttentionOverrides,
    getClientAttentionActions,
    type CoachAttentionActionRow,
} from "@/lib/coachAttentionActions";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { formatCheckInDueDate, formatCheckInWeekLabel, getIsoWeekYear } from "@/lib/checkInLabels";
import { getWeekNumber, parseLogDate } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";

export interface OverdueCheckInClient {
    id: string;
    name: string;
    label: string;
    weekNumber: number;
    periodLabel: string;
    dueDateLabel: string | null;
    daysOverdue: number | null;
    isOverdue: boolean;
    isDueToday: boolean;
}

/** App-timezone "today" for coach check-in overdue / attention logic. */
export function getCoachAppToday(referenceDate = new Date()) {
    const todayKey = getLocalTimeParts(referenceDate, APP_TIMEZONE).dateKey;
    const today = parseLogDate(todayKey);
    const weekNumber = getWeekNumber(today);
    return { today, todayKey, weekNumber };
}

/** Shared due-state for coach panel, inbox, and /checkins overdue tab. */
export function resolveCoachClientCheckInDueState(
    schedule: CheckInSchedule,
    clientActions: CoachAttentionActionRow[],
    clientId: string,
    lastActiveAt: Date | null | undefined,
    referenceDate = new Date()
): CheckInDueState & { weekNumber: number; todayKey: string } {
    const { today, todayKey, weekNumber } = getCoachAppToday(referenceDate);
    const dueStateRaw = getCheckInDueState(schedule, today);
    const dueState = applyCheckInAttentionOverrides(
        dueStateRaw,
        clientActions,
        clientId,
        dueStateRaw.outstandingWeekNumber ?? weekNumber,
        today,
        lastActiveAt
    );
    return {
        ...dueState,
        weekNumber: dueState.outstandingWeekNumber ?? weekNumber,
        todayKey,
    };
}

/** Needs coach attention: due today or overdue, not submitted, not dismissed. */
export function isCoachClientCheckInAttentionNeeded(
    dueState: CheckInDueState,
    hasCheckInForPeriod: boolean
): boolean {
    return dueState.isConfigured
        && !hasCheckInForPeriod
        && (dueState.isOverdue || dueState.isDueToday);
}

/** Clients assigned to this coach who owe a check-in (due today or overdue) without a submission. */
export async function getOverdueCheckInClientsForCoach(coachId: string): Promise<OverdueCheckInClient[]> {
    const { today } = getCoachAppToday();
    const lookback = new Date(today);
    lookback.setDate(lookback.getDate() - 90);

    const clients = await prisma.user.findMany({
        where: {
            coachId,
            role: { in: ["PREMIUM", "FREE"] },
            isDeleted: false,
            isDeactivated: false,
        },
        select: {
            id: true,
            name: true,
            email: true,
            lastActiveAt: true,
            isDeleted: true,
            isDeactivated: true,
            checkIns: {
                where: { createdAt: { gte: lookback } },
                select: { id: true, weekNumber: true },
            },
        },
        orderBy: { name: "asc" },
    });

    const overdue: OverdueCheckInClient[] = [];

    for (const client of clients) {
        if (isInactiveAccount(client)) continue;

        const schedule = await getUserCheckInSchedule(client.id);
        const clientActions = await getClientAttentionActions(client.id);
        const dueState = resolveCoachClientCheckInDueState(
            schedule,
            clientActions,
            client.id,
            client.lastActiveAt
        );

        const submittedWeeks = client.checkIns.map((c) => c.weekNumber);
        const hasSubmission = hasCheckInForOutstandingPeriod(dueState, submittedWeeks);
        if (!isCoachClientCheckInAttentionNeeded(dueState, hasSubmission)) continue;

        const periodWeek = dueState.outstandingWeekNumber ?? dueState.weekNumber;
        const dueDateLabel = formatCheckInDueDate(dueState.currentPeriodDueDate);
        const daysOverdue = dueState.isOverdue ? (dueState.daysOverdue ?? null) : null;

        overdue.push({
            id: client.id,
            name: client.name ?? client.email ?? "Client",
            label: dueState.isOverdue
                ? (daysOverdue != null && daysOverdue > 1
                    ? `OVERDUE · ${daysOverdue} days overdue`
                    : "OVERDUE / MISSED")
                : "DUE TODAY",
            weekNumber: periodWeek,
            periodLabel:
                dueDateLabel
                ?? formatCheckInWeekLabel(periodWeek, getIsoWeekYear(today)),
            dueDateLabel,
            daysOverdue,
            isOverdue: dueState.isOverdue,
            isDueToday: dueState.isDueToday,
        });
    }

    // Most overdue first, then due today, then name
    overdue.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (a.isOverdue && b.isOverdue) {
            const da = a.daysOverdue ?? 0;
            const db = b.daysOverdue ?? 0;
            if (da !== db) return db - da;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const nicknameMap = await loadNicknameMap(coachId, overdue.map((row) => row.id));
    if (nicknameMap.size === 0) return overdue;

    const clientById = new Map(clients.map((client) => [client.id, client]));
    return overdue.map((row) => {
        const nick = nicknameMap.get(row.id);
        if (!nick) return row;
        const client = clientById.get(row.id);
        return {
            ...row,
            name: pickDisplayName(client?.name, client?.email, nick, row.name),
        };
    });
}

export function getCoachCheckInWeekNumber(referenceDate = new Date()): number {
    return getCoachAppToday(referenceDate).weekNumber;
}

export function getCoachCheckInTodayKey(referenceDate = new Date()): string {
    return getCoachAppToday(referenceDate).todayKey;
}
