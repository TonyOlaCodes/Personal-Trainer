import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { getWeekNumber } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";

export interface OverdueCheckInClient {
    id: string;
    name: string;
    label: string;
    weekNumber: number;
    isOverdue: boolean;
}

/** Clients assigned to this coach who owe a check-in but have not submitted one this week. */
export async function getOverdueCheckInClientsForCoach(coachId: string): Promise<OverdueCheckInClient[]> {
    const now = new Date();
    const weekNumber = getWeekNumber(now);

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
        const dueState = getCheckInDueState(schedule, now);
        if (!dueState.isConfigured) continue;
        if (!dueState.isOverdue && !dueState.isDueToday) continue;

        overdue.push({
            id: client.id,
            name: client.name ?? client.email ?? "Client",
            label: dueState.isOverdue ? "Check-in overdue" : "Due today",
            weekNumber,
            isOverdue: dueState.isOverdue,
        });
    }

    overdue.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return overdue;
}

export function getCoachCheckInWeekNumber(referenceDate = new Date()): number {
    return getWeekNumber(referenceDate);
}

export function getCoachCheckInTodayKey(referenceDate = new Date()): string {
    return getLocalTimeParts(referenceDate, APP_TIMEZONE).dateKey;
}
