import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import { getPlannedWorkoutForDate, activeWorkoutWhere } from "@/lib/planSchedule";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { parseLogDate } from "@/lib/utils";
import { isInactiveAccount } from "@/lib/userDeactivation";
import {
    getCoachPauseStatusMap,
    shouldSuppressCoachMissedAttention,
} from "@/lib/coachClientPause";
import { loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";

export interface MissedWorkoutYesterdayRow {
    clientId: string;
    clientName: string;
    workoutId: string;
    workoutName: string;
    dateKey: string;
    dateLabel: string;
}

function formatScheduledDateLabel(dateKey: string, todayKey: string): string {
    if (dateKey === shiftDateKey(todayKey, -1)) return "Yesterday";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

export function getYesterdayDateKey(referenceDate = new Date()): string {
    const todayKey = getLocalTimeParts(referenceDate, APP_TIMEZONE).dateKey;
    return shiftDateKey(todayKey, -1);
}

/** Clients who had a planned workout yesterday but did not complete it. */
export async function getMissedWorkoutsYesterdayForCoach(
    coachId: string,
    referenceDate = new Date()
): Promise<MissedWorkoutYesterdayRow[]> {
    const todayKey = getLocalTimeParts(referenceDate, APP_TIMEZONE).dateKey;
    const yesterdayKey = shiftDateKey(todayKey, -1);
    const today = parseLogDate(todayKey);
    const lookbackStart = new Date(referenceDate.getTime() - 14 * 86400000);

    const clients = await prisma.user.findMany({
        where: {
            coachId,
            role: { in: ["PREMIUM", "FREE"] },
            isDeleted: false,
            isDeactivated: false,
            NOT: { email: { endsWith: "@deleted.local" } },
        },
        select: {
            id: true,
            name: true,
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
                    status: "COMPLETED",
                    loggedAt: { gte: lookbackStart },
                },
                select: { workoutId: true, loggedAt: true },
            },
        },
        orderBy: { name: "asc" },
    });

    const planIds = [
        ...new Set(
            clients
                .map((client) => client.plans[0]?.plan.id)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const [y, m, d] = yesterdayKey.split("-").map(Number);
    const yesterdayDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    const dateLabel = formatScheduledDateLabel(yesterdayKey, todayKey);

    const missed: MissedWorkoutYesterdayRow[] = [];
    const pauseStatusByClient = await getCoachPauseStatusMap(clients.map((c) => c.id));

    for (const client of clients) {
        if (isInactiveAccount(client)) continue;
        if (
            shouldSuppressCoachMissedAttention(
                {
                    isCoachPaused: pauseStatusByClient.get(client.id)?.isCoachPaused,
                    coachResumedAt: pauseStatusByClient.get(client.id)?.coachResumedAt ?? null,
                },
                yesterdayKey
            )
        ) {
            continue;
        }

        const activeUserPlan = client.plans[0] ?? null;
        const plannedWorkout = getPlannedWorkoutForDate(
            activeUserPlan
                ? {
                    startedAt: activeUserPlan.startedAt,
                    plan: activeUserPlan.plan,
                    scheduleRevisions: revisionsByPlanId[activeUserPlan.plan.id] ?? [],
                }
                : null,
            yesterdayDate,
            { today }
        );
        if (!plannedWorkout) continue;

        const completed = client.workoutLogs.some((log) => {
            if (log.workoutId !== plannedWorkout.id) return false;
            return getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey === yesterdayKey;
        });
        if (completed) continue;

        missed.push({
            clientId: client.id,
            clientName: client.name ?? client.email ?? "Client",
            workoutId: plannedWorkout.id,
            workoutName: plannedWorkout.name,
            dateKey: yesterdayKey,
            dateLabel,
        });
    }

    missed.sort((a, b) =>
        a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" })
    );

    const nicknameMap = await loadNicknameMap(coachId, missed.map((row) => row.clientId));
    if (nicknameMap.size === 0) return missed;

    return missed.map((row) => {
        const nick = nicknameMap.get(row.clientId);
        if (!nick) return row;
        const client = clients.find((c) => c.id === row.clientId);
        return {
            ...row,
            clientName: pickDisplayName(client?.name, client?.email, nick, row.clientName),
        };
    });
}

export function buildMissedWorkoutCalendarHref(row: Pick<MissedWorkoutYesterdayRow, "clientId" | "dateKey">): string {
    const params = new URLSearchParams({
        clientId: row.clientId,
        date: row.dateKey,
    });
    return `/coach/calendar?${params.toString()}`;
}
