import { prisma } from "@/lib/prisma";
import { getCoachAttentionActions } from "@/lib/coachAttentionActions";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { loadCoachAttentionInboxOpenOnly } from "@/lib/coachAttentionInbox";
import {
    getCoachAppToday,
    isCoachClientCheckInAttentionNeeded,
    resolveCoachClientCheckInDueState,
} from "@/lib/coachOverdueCheckIns";
import { isInactiveAccount } from "@/lib/userDeactivation";

export type CoachClientFilterFlags = {
    checkInDue: boolean;
    missedWorkout: boolean;
};

export async function getCoachClientFilterFlags(
    clientIds: string[],
    coachId?: string
): Promise<Record<string, CoachClientFilterFlags>> {
    if (clientIds.length === 0) return {};

    const { weekNumber } = getCoachAppToday();
    const clientIdSet = new Set(clientIds);

    const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
            id: true,
            isDeleted: true,
            isDeactivated: true,
            email: true,
            lastActiveAt: true,
            checkIns: {
                where: { weekNumber },
                select: { id: true },
                take: 1,
            },
        },
    });
    const missedClientIds = new Set<string>();
    const attentionActions = coachId ? await getCoachAttentionActions(coachId) : new Map();

    if (coachId) {
        const openAttentionItems = await loadCoachAttentionInboxOpenOnly(coachId);
        for (const item of openAttentionItems) {
            if (item.category !== "missed_workout") continue;
            if (!clientIdSet.has(item.clientId)) continue;
            missedClientIds.add(item.clientId);
        }
    }

    const result: Record<string, CoachClientFilterFlags> = {};

    await Promise.all(clients.map(async (client) => {
        if (isInactiveAccount(client)) {
            result[client.id] = { checkInDue: false, missedWorkout: false };
            return;
        }

        let checkInDue = false;
        if (client.checkIns.length === 0) {
            const schedule = await getUserCheckInSchedule(client.id);
            const clientAttentionRows = [...attentionActions.values()].filter((row) => row.clientId === client.id);
            const dueState = resolveCoachClientCheckInDueState(
                schedule,
                clientAttentionRows,
                client.id,
                client.lastActiveAt
            );
            checkInDue = isCoachClientCheckInAttentionNeeded(dueState, false);
        }

        result[client.id] = { checkInDue, missedWorkout: missedClientIds.has(client.id) };
    }));

    return result;
}
