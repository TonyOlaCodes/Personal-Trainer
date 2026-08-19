import { prisma } from "@/lib/prisma";
import { getCoachAttentionActions } from "@/lib/coachAttentionActions";
import { getUserCheckInSchedule, hasCheckInForOutstandingPeriod } from "@/lib/checkInSchedule";
import { loadCoachAttentionInboxOpenOnly } from "@/lib/coachAttentionInbox";
import {
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

    const clientIdSet = new Set(clientIds);
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 90);

    const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
            id: true,
            isDeleted: true,
            isDeactivated: true,
            email: true,
            lastActiveAt: true,
            checkIns: {
                where: { createdAt: { gte: lookback } },
                select: { id: true, weekNumber: true },
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

        const schedule = await getUserCheckInSchedule(client.id);
        const clientAttentionRows = [...attentionActions.values()].filter((row) => row.clientId === client.id);
        const dueState = resolveCoachClientCheckInDueState(
            schedule,
            clientAttentionRows,
            client.id,
            client.lastActiveAt
        );
        const hasSubmission = hasCheckInForOutstandingPeriod(
            dueState,
            client.checkIns.map((c) => c.weekNumber)
        );
        const checkInDue = isCoachClientCheckInAttentionNeeded(dueState, hasSubmission);

        result[client.id] = { checkInDue, missedWorkout: missedClientIds.has(client.id) };
    }));

    return result;
}
