import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, getUserCheckInSchedule, type CheckInDueState, type CheckInSchedule } from "@/lib/checkInSchedule";
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
    isOverdue: boolean;
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
        weekNumber,
        today,
        lastActiveAt
    );
    return { ...dueState, weekNumber, todayKey };
}

export function isCoachClientCheckInAttentionNeeded(
    dueState: CheckInDueState,
    hasCheckInThisWeek: boolean
): boolean {
    return dueState.isConfigured
        && !hasCheckInThisWeek
        && dueState.isOverdue;
}

/** Clients assigned to this coach who owe a check-in but have not submitted one this week. */
export async function getOverdueCheckInClientsForCoach(coachId: string): Promise<OverdueCheckInClient[]> {
    const { weekNumber } = getCoachAppToday();

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
                where: { weekNumber },
                select: { id: true },
                take: 1,
            },
        },
        orderBy: { name: "asc" },
    });

    const overdue: OverdueCheckInClient[] = [];

    for (const client of clients) {
        if (isInactiveAccount(client)) continue;
        if (client.checkIns.length > 0) continue;

        const schedule = await getUserCheckInSchedule(client.id);
        const clientActions = await getClientAttentionActions(client.id);
        const dueState = resolveCoachClientCheckInDueState(
            schedule,
            clientActions,
            client.id,
            client.lastActiveAt
        );
        if (!isCoachClientCheckInAttentionNeeded(dueState, false)) continue;

        overdue.push({
            id: client.id,
            name: client.name ?? client.email ?? "Client",
            label: dueState.isOverdue ? "Check-in overdue" : "Due today",
            weekNumber,
            periodLabel:
                formatCheckInDueDate(dueState.currentPeriodDueDate)
                ?? formatCheckInWeekLabel(weekNumber, getIsoWeekYear(parseLogDate(dueState.todayKey))),
            isOverdue: dueState.isOverdue,
        });
    }

    overdue.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
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
