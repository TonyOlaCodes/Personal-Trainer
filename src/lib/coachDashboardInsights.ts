import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, type CheckInSchedule } from "@/lib/checkInSchedule";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import {
    computeWeeklyCompliance,
    getMondayStart,
    type CalendarComplianceInput,
} from "@/lib/calendarCompliance";
import { getTotalUnreadDirectCount, getUnreadCountsByPeer } from "@/lib/chatUnread";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { getWeekNumber, parseLogDate, toDateKey } from "@/lib/utils";

export type CoachActivityType = "workout" | "bodyweight" | "checkin" | "message" | "pr";

export interface CoachActivityItem {
    id: string;
    type: CoachActivityType;
    clientId: string;
    clientName: string;
    text: string;
    timestamp: string;
    href: string;
}

export interface CoachAttentionItem {
    key: string;
    label: string;
    count: number;
    href: string;
    urgent?: boolean;
}

export interface UpcomingEvent {
    id: string;
    clientId: string;
    clientName: string;
    /** Workout name or check-in title */
    label: string;
    type: "checkin" | "workout";
    /** Human-readable type, e.g. "Workout" or "Check-in" */
    typeLabel: string;
    dateKey: string;
    /** Today, Tomorrow, or formatted date */
    dateLabel: string;
    href: string;
}

export interface ClientTodayWorkout {
    planned: boolean;
    completed: boolean;
    name: string | null;
}

export type ClientCheckInStatus =
    | "overdue"
    | "due_today"
    | "due_soon"
    | "scheduled"
    | "not_configured";

export interface ClientDashboardInsight {
    todayWorkout: ClientTodayWorkout;
    workoutStreak: number;
    checkInStatus: ClientCheckInStatus;
    checkInLabel: string;
    compliancePercent: number | null;
    unreadMessages: number;
    needsAttention: boolean;
}

export interface CoachDashboardInsights {
    attentionItems: CoachAttentionItem[];
    activityFeed: CoachActivityItem[];
    upcomingEvents: UpcomingEvent[];
    clientInsights: Record<string, ClientDashboardInsight>;
    totals: {
        clientsNeedingAttention: number;
        pendingCheckIns: number;
        unreadMessages: number;
        activeWorkoutsNow: number;
        missedWorkoutsToday: number;
        overdueCheckIns: number;
        setupNeeded: number;
    };
}

interface ActiveClientRow {
    id: string;
    name: string;
    isDeleted: boolean;
    isDeactivated: boolean;
    email: string;
    hasCheckInSchedule: boolean;
    checkInSchedule: CheckInSchedule;
    currentWeekCheckInId: string | null;
    activeSession: { workoutName: string } | null;
}

function computeStreakFromDateKeys(dateKeys: string[], todayKey: string): number {
    const unique = [...new Set(dateKeys)].sort((a, b) => b.localeCompare(a));
    if (unique.length === 0) return 0;

    let streak = 0;
    let cursor = parseLogDate(todayKey);
    if (!unique.includes(todayKey)) {
        cursor.setDate(cursor.getDate() - 1);
    }

    while (unique.includes(toDateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

function buildCheckInLabel(
    dueState: ReturnType<typeof getCheckInDueState>,
    hasCheckInThisWeek: boolean
): { status: ClientCheckInStatus; label: string } {
    if (!dueState.isConfigured) {
        return { status: "not_configured", label: "No check-in schedule" };
    }
    if (hasCheckInThisWeek) {
        if (dueState.daysUntilNext === 1) {
            return { status: "scheduled", label: "Next check-in tomorrow" };
        }
        if (dueState.daysUntilNext != null && dueState.daysUntilNext <= 7) {
            return { status: "scheduled", label: `Next check-in in ${dueState.daysUntilNext}d` };
        }
        return { status: "scheduled", label: `Next: ${dueState.dueDayLabel ?? "scheduled"}` };
    }
    if (dueState.isOverdue) {
        return { status: "overdue", label: "Check-in overdue" };
    }
    if (dueState.isDueToday) {
        return { status: "due_today", label: "Check-in due today" };
    }
    if (dueState.isDueWeek) {
        return { status: "due_soon", label: "Check-in due this week" };
    }
    if (dueState.daysUntilNext != null && dueState.daysUntilNext <= 3) {
        return { status: "due_soon", label: `Check-in in ${dueState.daysUntilNext}d` };
    }
    return { status: "scheduled", label: `Next: ${dueState.dueDayLabel ?? "scheduled"}` };
}

function formatUpcomingDateLabel(dateKey: string, todayKey: string): string {
    if (dateKey === todayKey) return "Today";
    if (dateKey === shiftDateKey(todayKey, 1)) return "Tomorrow";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
    }).format(date);
}

const UPCOMING_LOOKAHEAD_DAYS = 7;

function formatActivityTimestamp(date: Date | string): string {
    const parsed = new Date(date);
    const now = new Date();
    const diff = now.getTime() - parsed.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        day: "numeric",
        month: "short",
    }).format(parsed);
}

export async function loadCoachDashboardInsights(input: {
    coachId: string;
    clients: ActiveClientRow[];
    pendingReviewCount: number;
    pendingReviewClientIds: string[];
    activeSessions: Record<string, { workoutName: string } | null>;
}): Promise<CoachDashboardInsights> {
    const activeClients = input.clients.filter(
        (c) => !c.isDeleted && !c.isDeactivated && !c.email.endsWith("@deleted.local")
    );
    const activeClientIds = activeClients.map((c) => c.id);
    const todayKey = getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey;
    const today = parseLogDate(todayKey);
    const weekStart = getMondayStart(today);
    const currentIsoWeek = getWeekNumber(today);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const streakLookback = new Date(Date.now() - 90 * 86400000);

    const [
        userPlans,
        todayCompletedLogs,
        weekLogDates,
        streakLogs,
        activityWorkouts,
        activityCheckIns,
        activityMessages,
        activityPrs,
        activityBodyweight,
        unreadByPeer,
    ] = await Promise.all([
        activeClientIds.length > 0
            ? prisma.userPlan.findMany({
                where: { userId: { in: activeClientIds }, isActive: true },
                select: {
                    userId: true,
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
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.workoutLog.findMany({
                where: {
                    userId: { in: activeClientIds },
                    status: "COMPLETED",
                    loggedAt: {
                        gte: parseLogDate(todayKey),
                        lt: new Date(parseLogDate(todayKey).getTime() + 86400000),
                    },
                },
                select: { userId: true, workoutId: true },
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.workoutLog.findMany({
                where: {
                    userId: { in: activeClientIds },
                    status: "COMPLETED",
                    loggedAt: { gte: weekStart },
                },
                select: { userId: true, loggedAt: true },
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.workoutLog.findMany({
                where: {
                    userId: { in: activeClientIds },
                    status: "COMPLETED",
                    loggedAt: { gte: streakLookback },
                },
                select: { userId: true, loggedAt: true },
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.workoutLog.findMany({
                where: {
                    userId: { in: activeClientIds },
                    status: "COMPLETED",
                    loggedAt: { gte: sevenDaysAgo },
                },
                select: {
                    id: true,
                    userId: true,
                    loggedAt: true,
                    workout: { select: { name: true } },
                    user: { select: { name: true } },
                },
                orderBy: { loggedAt: "desc" },
                take: 20,
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.checkIn.findMany({
                where: {
                    userId: { in: activeClientIds },
                    createdAt: { gte: sevenDaysAgo },
                },
                select: {
                    id: true,
                    userId: true,
                    weekNumber: true,
                    createdAt: true,
                    user: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.message.findMany({
                where: {
                    senderId: { in: activeClientIds },
                    receiverId: input.coachId,
                    isGeneral: false,
                    createdAt: { gte: sevenDaysAgo },
                },
                select: {
                    id: true,
                    senderId: true,
                    createdAt: true,
                    sender: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.logSet.findMany({
                where: {
                    isPR: true,
                    workoutLog: {
                        userId: { in: activeClientIds },
                        status: "COMPLETED",
                        loggedAt: { gte: sevenDaysAgo },
                    },
                },
                select: {
                    id: true,
                    workoutLog: {
                        select: {
                            userId: true,
                            loggedAt: true,
                            user: { select: { name: true } },
                        },
                    },
                    exercise: { select: { name: true } },
                },
                orderBy: { workoutLog: { loggedAt: "desc" } },
                take: 15,
            })
            : Promise.resolve([]),
        activeClientIds.length > 0
            ? prisma.$queryRaw<Array<{ userId: string; weightKg: number; updatedAt: Date; name: string | null }>>`
                SELECT bl."userId", bl."weightKg", bl."updatedAt", u."name"
                FROM "bodyweight_logs" bl
                JOIN "users" u ON u."id" = bl."userId"
                WHERE bl."userId" IN (${Prisma.join(activeClientIds)})
                  AND bl."updatedAt" >= ${sevenDaysAgo}
                ORDER BY bl."updatedAt" DESC
                LIMIT 20
            `
            : Promise.resolve([]),
        getUnreadCountsByPeer(input.coachId, activeClientIds),
    ]);

    const planIds = [...new Set(userPlans.map((row) => row.plan.id))];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const planByUserId = new Map(userPlans.map((row) => [row.userId, row]));
    const todayCompletedByUser = new Map<string, Set<string>>();
    for (const log of todayCompletedLogs) {
        const set = todayCompletedByUser.get(log.userId) ?? new Set<string>();
        set.add(log.workoutId);
        todayCompletedByUser.set(log.userId, set);
    }

    const weekDatesByUser = new Map<string, string[]>();
    for (const log of weekLogDates) {
        const rows = weekDatesByUser.get(log.userId) ?? [];
        rows.push(toDateKey(log.loggedAt));
        weekDatesByUser.set(log.userId, rows);
    }

    const streakDatesByUser = new Map<string, string[]>();
    for (const log of streakLogs) {
        const rows = streakDatesByUser.get(log.userId) ?? [];
        rows.push(toDateKey(log.loggedAt));
        streakDatesByUser.set(log.userId, rows);
    }

    const clientInsights: Record<string, ClientDashboardInsight> = {};
    let missedWorkoutsToday = 0;
    let overdueCheckIns = 0;
    let setupNeeded = 0;
    const clientsNeedingAttentionIds = new Set<string>();
    const upcomingEvents: UpcomingEvent[] = [];

    for (const client of activeClients) {
        const userPlan = planByUserId.get(client.id);
        let activeUserPlan: ActiveUserPlanLike | null = null;
        if (userPlan) {
            activeUserPlan = {
                startedAt: userPlan.startedAt,
                plan: userPlan.plan,
                scheduleRevisions: revisionsByPlanId[userPlan.plan.id] ?? [],
            };
        }

        const plannedToday = getPlannedWorkoutForDate(activeUserPlan, today, { today });
        const completedToday = plannedToday
            ? (todayCompletedByUser.get(client.id)?.has(plannedToday.id) ?? false)
            : false;

        const todayWorkout: ClientTodayWorkout = {
            planned: Boolean(plannedToday),
            completed: completedToday,
            name: plannedToday?.name ?? null,
        };

        if (plannedToday && !completedToday && !input.activeSessions[client.id]) {
            missedWorkoutsToday++;
            clientsNeedingAttentionIds.add(client.id);
        }

        const dueState = getCheckInDueState(client.checkInSchedule, today);
        const hasCheckInThisWeek = Boolean(client.currentWeekCheckInId);
        const { status: checkInStatus, label: checkInLabel } = buildCheckInLabel(dueState, hasCheckInThisWeek);

        if (
            dueState.isConfigured
            && !hasCheckInThisWeek
            && (dueState.isOverdue || dueState.isDueToday)
        ) {
            overdueCheckIns++;
            clientsNeedingAttentionIds.add(client.id);
        }

        if (!client.hasCheckInSchedule) {
            setupNeeded++;
            clientsNeedingAttentionIds.add(client.id);
        }

        const unreadMessages = unreadByPeer[client.id] ?? 0;
        if (unreadMessages > 0) {
            clientsNeedingAttentionIds.add(client.id);
        }

        const complianceInput: CalendarComplianceInput = {
            activePlan: activeUserPlan ? { weeks: activeUserPlan.plan.weeks } : null,
            planStartedAt: userPlan?.startedAt.toISOString() ?? null,
            loggedDates: (weekDatesByUser.get(client.id) ?? []).map((date) => ({ date })),
            scheduleRevisions: activeUserPlan?.scheduleRevisions,
        };
        const compliance = computeWeeklyCompliance(complianceInput, today, {
            excludeTodayUntilLogged: true,
        });

        const workoutStreak = computeStreakFromDateKeys(streakDatesByUser.get(client.id) ?? [], todayKey);

        const needsAttention =
            (plannedToday && !completedToday && !input.activeSessions[client.id])
            || (dueState.isConfigured && !hasCheckInThisWeek && (dueState.isOverdue || dueState.isDueToday))
            || !client.hasCheckInSchedule
            || unreadMessages > 0;

        clientInsights[client.id] = {
            todayWorkout,
            workoutStreak,
            checkInStatus,
            checkInLabel,
            compliancePercent: compliance.percent,
            unreadMessages,
            needsAttention,
        };
    }

    for (const client of activeClients) {
        const userPlan = planByUserId.get(client.id);
        let activeUserPlan: ActiveUserPlanLike | null = null;
        if (userPlan) {
            activeUserPlan = {
                startedAt: userPlan.startedAt,
                plan: userPlan.plan,
                scheduleRevisions: revisionsByPlanId[userPlan.plan.id] ?? [],
            };
        }

        const hasCheckInThisWeek = Boolean(client.currentWeekCheckInId);

        for (let dayOffset = 0; dayOffset <= UPCOMING_LOOKAHEAD_DAYS; dayOffset++) {
            const dateKey = shiftDateKey(todayKey, dayOffset);
            const date = parseLogDate(dateKey);

            const plannedWorkout = getPlannedWorkoutForDate(activeUserPlan, date, { today });
            if (plannedWorkout) {
                upcomingEvents.push({
                    id: `${client.id}-workout-${dateKey}`,
                    clientId: client.id,
                    clientName: client.name,
                    type: "workout",
                    typeLabel: "Workout",
                    label: plannedWorkout.name,
                    dateKey,
                    dateLabel: formatUpcomingDateLabel(dateKey, todayKey),
                    href: `/coach/client/${client.id}`,
                });
            }

            if (!hasCheckInThisWeek && client.checkInSchedule) {
                const dueOnDate = getCheckInDueState(client.checkInSchedule, date);
                if (dueOnDate.isConfigured && dueOnDate.isDueToday) {
                    upcomingEvents.push({
                        id: `${client.id}-checkin-${dateKey}`,
                        clientId: client.id,
                        clientName: client.name,
                        type: "checkin",
                        typeLabel: "Check-in",
                        label: "Weekly check-in",
                        dateKey,
                        dateLabel: formatUpcomingDateLabel(dateKey, todayKey),
                        href: `/coach/client/${client.id}`,
                    });
                }
            }
        }
    }

    upcomingEvents.sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        if (a.type !== b.type) return a.type === "checkin" ? -1 : 1;
        return a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" });
    });

    const unreadTotal = Object.values(unreadByPeer).reduce((sum, n) => sum + n, 0);
    const activeWorkoutsNow = Object.values(input.activeSessions).filter(Boolean).length;

    for (const clientId of input.pendingReviewClientIds) {
        clientsNeedingAttentionIds.add(clientId);
    }

    const attentionItems: CoachAttentionItem[] = [
        {
            key: "missed-workouts",
            label: "Missed today's workout",
            count: missedWorkoutsToday,
            href: "/coach/calendar",
            urgent: missedWorkoutsToday > 0,
        },
        {
            key: "overdue-checkins",
            label: "Overdue check-ins",
            count: overdueCheckIns,
            href: "/checkins?view=overdue",
            urgent: overdueCheckIns > 0,
        },
        {
            key: "pending-reviews",
            label: "Pending check-ins to review",
            count: input.pendingReviewCount,
            href: "/checkins?status=PENDING",
            urgent: input.pendingReviewCount > 0,
        },
        {
            key: "setup-needed",
            label: "Clients needing setup",
            count: setupNeeded,
            href: "/coach#clients",
            urgent: setupNeeded > 0,
        },
        {
            key: "unread-messages",
            label: "Unread client messages",
            count: unreadTotal,
            href: "/chat",
            urgent: unreadTotal > 0,
        },
    ].filter((item) => item.count > 0);

    const activityFeed: CoachActivityItem[] = [
        ...activityWorkouts.map((log) => ({
            id: `workout-${log.id}`,
            type: "workout" as const,
            clientId: log.userId,
            clientName: log.user.name || "Client",
            text: `completed ${log.workout.name}`,
            timestamp: log.loggedAt.toISOString(),
            href: `/coach/client/${log.userId}`,
        })),
        ...activityCheckIns.map((checkIn) => ({
            id: `checkin-${checkIn.id}`,
            type: "checkin" as const,
            clientId: checkIn.userId,
            clientName: checkIn.user.name || "Client",
            text: `submitted Week ${checkIn.weekNumber} Check-in`,
            timestamp: checkIn.createdAt.toISOString(),
            href: `/checkins?highlight=${checkIn.id}`,
        })),
        ...activityMessages.map((message) => ({
            id: `message-${message.id}`,
            type: "message" as const,
            clientId: message.senderId,
            clientName: message.sender.name || "Client",
            text: "sent a message",
            timestamp: message.createdAt.toISOString(),
            href: `/chat`,
        })),
        ...activityPrs.map((set) => ({
            id: `pr-${set.id}`,
            type: "pr" as const,
            clientId: set.workoutLog.userId,
            clientName: set.workoutLog.user.name || "Client",
            text: `achieved a ${set.exercise.name} PR`,
            timestamp: set.workoutLog.loggedAt.toISOString(),
            href: `/coach/client/${set.workoutLog.userId}`,
        })),
        ...activityBodyweight.map((row) => ({
            id: `bw-${row.userId}-${row.updatedAt.toISOString()}`,
            type: "bodyweight" as const,
            clientId: row.userId,
            clientName: row.name || "Client",
            text: `logged bodyweight (${row.weightKg.toFixed(1)} kg)`,
            timestamp: row.updatedAt.toISOString(),
            href: `/coach/client/${row.userId}`,
        })),
    ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 30);

    return {
        attentionItems,
        activityFeed,
        upcomingEvents,
        clientInsights,
        totals: {
            clientsNeedingAttention: clientsNeedingAttentionIds.size,
            pendingCheckIns: input.pendingReviewCount,
            unreadMessages: unreadTotal,
            activeWorkoutsNow,
            missedWorkoutsToday,
            overdueCheckIns,
            setupNeeded,
        },
    };
}

export async function getCoachUnreadMessageTotal(coachId: string, clientIds: string[]) {
    return getTotalUnreadDirectCount(coachId, clientIds);
}

export { formatActivityTimestamp };
