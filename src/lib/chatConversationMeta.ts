import { APP_TIMEZONE } from "@/lib/appTimezone";
import {
    getCoachAttentionActions,
    getEffectiveCheckInDueStatesForUsers,
    getExcusedMissedWorkoutKeysForClient,
} from "@/lib/coachAttentionActions";
import { getCoachPauseStatusMap } from "@/lib/coachClientPause";
import {
    COACH_MISSED_WORKOUT_LOOKBACK_DAYS,
    hasGenuineMissedScheduledWorkout,
    logSlotKey,
} from "@/lib/coachMissedScheduledWorkouts";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import { getCoachAppToday, isCoachClientCheckInDueForFilter } from "@/lib/coachOverdueCheckIns";
import { type ActiveUserPlanLike } from "@/lib/planSchedule";
import { loadHistoricalMissedSessionsByUserIds } from "@/lib/planMissedSessionHistory";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { prisma } from "@/lib/prisma";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { parseLogDate } from "@/lib/utils";

export type CoachClientFilterFlags = {
    checkInDue: boolean;
    missedWorkout: boolean;
};

function emptyFlags(): CoachClientFilterFlags {
    return { checkInDue: false, missedWorkout: false };
}

/**
 * Coach chat filter flags for CHECK-IN DUE and MISSED WORKOUT.
 * Reuses the same effective check-in due state as the dashboard / profile / check-ins
 * pages, and the same scheduled-day status as calendar (`resolveWorkoutDayStatus`).
 */
export async function getCoachClientFilterFlags(
    clientIds: string[],
    coachId?: string
): Promise<Record<string, CoachClientFilterFlags>> {
    if (clientIds.length === 0) return {};

    const { today, todayKey } = getCoachAppToday();
    const lookbackStartKey = shiftDateKey(todayKey, -COACH_MISSED_WORKOUT_LOOKBACK_DAYS);
    const lookbackStart = parseLogDate(lookbackStartKey);

    const [clients, pauseStatusByClient, dueStates, attentionActions, historicalMissedByUserId] = await Promise.all([
        prisma.user.findMany({
            where: {
                id: { in: clientIds },
                ...(coachId ? { coachId } : {}),
            },
            select: {
                id: true,
                email: true,
                isDeleted: true,
                isDeactivated: true,
                plans: {
                    where: { isActive: true },
                    take: 1,
                    select: {
                        startedAt: true,
                        plan: {
                            select: {
                                id: true,
                                weeks: {
                                    orderBy: { weekNumber: "asc" },
                                    select: {
                                        weekNumber: true,
                                        workouts: {
                                            where: activeWorkoutWhere(),
                                            orderBy: { dayNumber: "asc" },
                                            select: {
                                                id: true,
                                                name: true,
                                                dayNumber: true,
                                                dayOfWeek: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                workoutLogs: {
                    where: {
                        OR: [
                            { status: "COMPLETED", loggedAt: { gte: lookbackStart } },
                            { status: "IN_PROGRESS" },
                        ],
                    },
                    select: { workoutId: true, loggedAt: true, status: true },
                },
            },
        }),
        getCoachPauseStatusMap(clientIds),
        getEffectiveCheckInDueStatesForUsers(clientIds, today),
        coachId ? getCoachAttentionActions(coachId) : Promise.resolve(new Map()),
        loadHistoricalMissedSessionsByUserIds(clientIds),
    ]);

    const planIds = [
        ...new Set(
            clients
                .map((client) => client.plans[0]?.plan.id)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const result: Record<string, CoachClientFilterFlags> = {};
    for (const clientId of clientIds) {
        result[clientId] = emptyFlags();
    }

    for (const client of clients) {
        if (isInactiveAccount(client)) {
            result[client.id] = emptyFlags();
            continue;
        }

        const pauseClient = {
            isCoachPaused: pauseStatusByClient.get(client.id)?.isCoachPaused ?? false,
            coachResumedAt: pauseStatusByClient.get(client.id)?.coachResumedAt ?? null,
        };
        const dueState = dueStates.get(client.id);
        const checkInDue = dueState
            ? isCoachClientCheckInDueForFilter(dueState, pauseClient)
            : false;

        const activePlan = client.plans[0] ?? null;
        let activeUserPlan: ActiveUserPlanLike | null = null;
        if (activePlan) {
            activeUserPlan = {
                startedAt: activePlan.startedAt,
                plan: activePlan.plan,
                scheduleRevisions: revisionsByPlanId[activePlan.plan.id] ?? [],
            };
        }

        const completedLogKeys = new Set<string>();
        const inProgressLogKeys = new Set<string>();
        for (const log of client.workoutLogs) {
            const dateKey = getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey;
            const key = logSlotKey(dateKey, log.workoutId);
            if (log.status === "IN_PROGRESS") inProgressLogKeys.add(key);
            else completedLogKeys.add(key);
        }

        const missedWorkout = hasGenuineMissedScheduledWorkout({
            today,
            todayKey,
            activeUserPlan,
            completedLogKeys,
            inProgressLogKeys,
            excusedKeys: new Set(getExcusedMissedWorkoutKeysForClient(attentionActions, client.id)),
            pauseClient,
            historicalMissedSessions: historicalMissedByUserId.get(client.id) ?? [],
        });

        result[client.id] = { checkInDue, missedWorkout };
    }

    return result;
}
