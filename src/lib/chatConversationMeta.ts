import { prisma } from "@/lib/prisma";
import {
    getCoachAttentionActions,
    getEffectiveCheckInDueStateForUser,
    isMissedWorkoutExcused,
} from "@/lib/coachAttentionActions";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getMissedWorkoutsYesterdayForCoach } from "@/lib/coachMissedWorkoutsYesterday";
import { getWeekNumber } from "@/lib/utils";
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

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const weekNumber = getWeekNumber(today);
    const clientIdSet = new Set(clientIds);

    const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: {
            id: true,
            isDeleted: true,
            isDeactivated: true,
            email: true,
            checkIns: {
                where: { weekNumber },
                select: { id: true },
                take: 1,
            },
        },
    });
    const missedClientIds = new Set<string>();

    if (coachId) {
        const [missedWorkouts, attentionActions] = await Promise.all([
            getMissedWorkoutsYesterdayForCoach(coachId),
            getCoachAttentionActions(coachId),
        ]);
        for (const row of missedWorkouts) {
            if (!clientIdSet.has(row.clientId)) continue;
            if (isMissedWorkoutExcused(attentionActions, row.clientId, row.dateKey, row.workoutId)) continue;
            missedClientIds.add(row.clientId);
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
            const dueState = await getEffectiveCheckInDueStateForUser(client.id, schedule, today);
            checkInDue = dueState.isDueToday || dueState.isOverdue;
        }

        result[client.id] = { checkInDue, missedWorkout: missedClientIds.has(client.id) };
    }));

    return result;
}
