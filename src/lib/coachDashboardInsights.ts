import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import {
    canonicalPeriodDueDateKey,
    getCheckInDueState,
    hasCheckInForOutstandingPeriod,
    type CheckInSchedule,
} from "@/lib/checkInSchedule";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import {
    computeWeeklyCompliance,
    getMondayStart,
    type CalendarComplianceInput,
} from "@/lib/calendarCompliance";
import { getTotalUnreadDirectCount, getUnreadCountsByPeer } from "@/lib/chatUnread";
import { getMissedWorkoutsYesterdayForCoach } from "@/lib/coachMissedWorkoutsYesterday";
import { loadCoachAttentionInboxOpenOnly } from "@/lib/coachAttentionInbox";
import {
    applyCheckInAttentionOverrides,
    buildMissedWorkoutAlertKey,
    buildSetupNeededAlertKey,
    buildUnreadMessageAlertKey,
    getCoachAttentionActions,
    getExcusedMissedWorkoutKeysForClient,
    isDismissedAlertCurrentlyHidden,
    isMissedWorkoutExcused,
} from "@/lib/coachAttentionActions";
import { getPlannedWorkoutForDate, getPlanStartDateKey, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { loadHistoricalMissedSessionsByUserIds, filterHistoricalMissedForActivePlan } from "@/lib/planMissedSessionHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { formatCheckInDueDate } from "@/lib/checkInLabels";
import {
    getCoachAppToday,
    isCoachClientCheckInAttentionNeeded,
} from "@/lib/coachOverdueCheckIns";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { computeWorkoutAdherence } from "@/lib/workoutAdherenceStreak";

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
    /** First few open inbox rows for dashboard preview (matches action inbox). */
    attentionInboxPreview: string[];
    upcomingEvents: UpcomingEvent[];
    clientInsights: Record<string, ClientDashboardInsight>;
    totals: {
        clientsNeedingAttention: number;
        pendingCheckIns: number;
        unreadMessages: number;
        activeWorkoutsNow: number;
        missedWorkoutsYesterday: number;
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
    lastActiveAt: Date | null;
    hasCheckInSchedule: boolean;
    checkInSchedule: CheckInSchedule;
    /** Recent check-in ISO week numbers (for matching outstanding periods). */
    recentCheckInWeekNumbers: number[];
    isCoachPaused?: boolean;
    coachResumedAt?: Date | null;
    activeSession: { workoutName: string } | null;
}

function buildCheckInLabel(
    dueState: ReturnType<typeof getCheckInDueState>,
    hasCheckInForPeriod: boolean
): { status: ClientCheckInStatus; label: string } {
    const periodDate = formatCheckInDueDate(dueState.currentPeriodDueDate);
    const nextDate = formatCheckInDueDate(dueState.nextDueDate);

    if (!dueState.isConfigured) {
        return { status: "not_configured", label: "No check-in schedule" };
    }
    if (hasCheckInForPeriod) {
        if (dueState.daysUntilNext === 1 && nextDate) {
            return { status: "scheduled", label: `Next check-in tomorrow · ${nextDate}` };
        }
        if (dueState.daysUntilNext != null && dueState.daysUntilNext <= 7 && nextDate) {
            return { status: "scheduled", label: `Next check-in · ${nextDate}` };
        }
        if (nextDate) return { status: "scheduled", label: `Next check-in · ${nextDate}` };
        return { status: "scheduled", label: "Next check-in scheduled" };
    }
    if (dueState.isOverdue) {
        const days = dueState.daysOverdue;
        return {
            status: "overdue",
            label: periodDate
                ? (days != null && days > 1
                    ? `Overdue · due ${periodDate} · ${days} days`
                    : `Overdue · due ${periodDate}`)
                : "Check-in overdue",
        };
    }
    if (dueState.isDueToday) {
        return {
            status: "due_today",
            label: periodDate ? `Due today · ${periodDate}` : "Check-in due today",
        };
    }
    if (dueState.isDueWeek) {
        return {
            status: "due_soon",
            label: periodDate ? `Due this week · ${periodDate}` : "Check-in due this week",
        };
    }
    if (dueState.daysUntilNext != null && dueState.daysUntilNext > 0) {
        if (dueState.daysUntilNext === 1 && nextDate) {
            return { status: "scheduled", label: `Next check-in tomorrow · ${nextDate}` };
        }
        if (nextDate) {
            return { status: "scheduled", label: `Next check-in · ${nextDate}` };
        }
        return { status: "scheduled", label: `Next check-in in ${dueState.daysUntilNext}d` };
    }
    if (dueState.daysUntilNext != null && dueState.daysUntilNext <= 3 && nextDate) {
        return { status: "due_soon", label: `Check-in · ${nextDate}` };
    }
    if (nextDate) return { status: "scheduled", label: `Next check-in · ${nextDate}` };
    return { status: "scheduled", label: "Next check-in scheduled" };
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
    const { today, todayKey, weekNumber: currentIsoWeek } = getCoachAppToday();
    const weekStart = getMondayStart(today);

    const [
        userPlans,
        todayCompletedLogs,
        weekLogDates,
        adherenceLogs,
        unreadByPeer,
        missedWorkoutsYesterday,
        attentionActions,
        historicalMissedByUserId,
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
                                            exercises: { select: { id: true } },
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
                },
                select: { userId: true, workoutId: true, loggedAt: true },
            })
            : Promise.resolve([]),
        getUnreadCountsByPeer(input.coachId, activeClientIds),
        getMissedWorkoutsYesterdayForCoach(input.coachId),
        getCoachAttentionActions(input.coachId),
        loadHistoricalMissedSessionsByUserIds(activeClientIds),
    ]);

    const planIds = [...new Set(userPlans.map((row) => row.plan.id))];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const planByUserId = new Map(userPlans.map((row) => [row.userId, row]));
    const planStartedAtByUser = new Map(
        userPlans.map((row) => [row.userId, parseLogDate(getPlanStartDateKey(row.startedAt)).getTime()])
    );
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

    const adherenceLogsByUser = new Map<string, Array<{ workoutId: string; dateKey: string }>>();
    const completedWorkoutDateKeysByUser = new Map<string, Set<string>>();
    for (const log of adherenceLogs) {
        const startedAt = planStartedAtByUser.get(log.userId);
        if (startedAt != null && log.loggedAt.getTime() < startedAt) continue;

        const dateKey = getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey;
        const rows = adherenceLogsByUser.get(log.userId) ?? [];
        rows.push({
            workoutId: log.workoutId,
            dateKey,
        });
        adherenceLogsByUser.set(log.userId, rows);

        const completedKeys = completedWorkoutDateKeysByUser.get(log.userId) ?? new Set<string>();
        completedKeys.add(`${log.workoutId}:${dateKey}`);
        completedWorkoutDateKeysByUser.set(log.userId, completedKeys);
    }

    const clientInsights: Record<string, ClientDashboardInsight> = {};
    const openMissedWorkoutsYesterday = missedWorkoutsYesterday.filter(
        (row) => !isMissedWorkoutExcused(attentionActions, row.clientId, row.dateKey, row.workoutId)
    );
    const missedWorkoutsYesterdayCount = openMissedWorkoutsYesterday.length;
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

        const plannedTodayRaw = getPlannedWorkoutForDate(activeUserPlan, today, { today });
        const plannedToday = isScheduledTrainingWorkout(plannedTodayRaw) ? plannedTodayRaw : null;
        const completedToday = plannedToday
            ? (todayCompletedByUser.get(client.id)?.has(plannedToday.id) ?? false)
            : false;

        const todayWorkout: ClientTodayWorkout = {
            planned: Boolean(plannedToday),
            completed: completedToday,
            name: plannedToday?.name ?? null,
        };

        const dueStateRaw = getCheckInDueState(client.checkInSchedule, today);
        const clientAttentionRows = [...attentionActions.values()].filter((row) => row.clientId === client.id);
        const dueState = applyCheckInAttentionOverrides(
            dueStateRaw,
            clientAttentionRows,
            client.id,
            dueStateRaw.outstandingWeekNumber ?? currentIsoWeek,
            today,
            client.lastActiveAt
        );
        const hasCheckInForPeriod = hasCheckInForOutstandingPeriod(
            dueState,
            client.recentCheckInWeekNumbers
        );
        const { status: checkInStatus, label: checkInLabel } = buildCheckInLabel(dueState, hasCheckInForPeriod);

        const isPaused = Boolean(client.isCoachPaused);
        if (
            !isPaused
            && isCoachClientCheckInAttentionNeeded(dueState, hasCheckInForPeriod)
        ) {
            const periodDueKey = canonicalPeriodDueDateKey(dueState.currentPeriodDueDate);
            // Avoid backlog for periods before the latest resume.
            const resumedAt = client.coachResumedAt;
            const resumedKey = resumedAt ? toDateKey(resumedAt) : null;
            const isPreResumeBacklog = Boolean(periodDueKey && resumedKey && periodDueKey < resumedKey);
            if (!isPreResumeBacklog) {
                overdueCheckIns++;
                clientsNeedingAttentionIds.add(client.id);
            }
        }

        if (
            !isPaused
            && !client.hasCheckInSchedule
            && !isDismissedAlertCurrentlyHidden(
                attentionActions.get(buildSetupNeededAlertKey(client.id)),
                client.lastActiveAt
            )
        ) {
            setupNeeded++;
            clientsNeedingAttentionIds.add(client.id);
        }

        const unreadMessages = unreadByPeer[client.id] ?? 0;
        if (
            unreadMessages > 0
            && !isDismissedAlertCurrentlyHidden(
                attentionActions.get(buildUnreadMessageAlertKey(client.id)),
                client.lastActiveAt
            )
        ) {
            clientsNeedingAttentionIds.add(client.id);
        }

        const complianceInput: CalendarComplianceInput = {
            activePlan: activeUserPlan ? { weeks: activeUserPlan.plan.weeks } : null,
            planStartedAt: userPlan?.startedAt.toISOString() ?? null,
            loggedDates: (weekDatesByUser.get(client.id) ?? []).map((date) => ({ date })),
            scheduleRevisions: activeUserPlan?.scheduleRevisions,
            excusedMissedWorkoutKeys: getExcusedMissedWorkoutKeysForClient(attentionActions, client.id),
            historicalMissedSessions: historicalMissedByUserId.get(client.id) ?? [],
        };
        const compliance = computeWeeklyCompliance(complianceInput, today, {
            excludeTodayUntilLogged: true,
        });

        const workoutStreak = activeUserPlan && userPlan
            ? computeWorkoutAdherence({
                activeUserPlan,
                completedLogs: adherenceLogsByUser.get(client.id) ?? [],
                excusedMissedWorkoutKeys: getExcusedMissedWorkoutKeysForClient(attentionActions, client.id),
                historicalMissedSessions: filterHistoricalMissedForActivePlan(
                    historicalMissedByUserId.get(client.id) ?? [],
                    userPlan.plan.id,
                    userPlan.startedAt
                ),
                today,
            }).currentStreak
            : 0;

        const checkInNeedsAttention =
            !isPaused
            && isCoachClientCheckInAttentionNeeded(dueState, hasCheckInForPeriod);
        const setupNeedsAttention =
            !isPaused
            && !client.hasCheckInSchedule
            && !isDismissedAlertCurrentlyHidden(
                attentionActions.get(buildSetupNeededAlertKey(client.id)),
                client.lastActiveAt
            );
        const unreadNeedsAttention =
            unreadMessages > 0
            && !isDismissedAlertCurrentlyHidden(
                attentionActions.get(buildUnreadMessageAlertKey(client.id)),
                client.lastActiveAt
            );

        const missedWorkoutNeedsAttention =
            !isPaused
            && openMissedWorkoutsYesterday.some(
            (row) =>
                row.clientId === client.id
                && !isDismissedAlertCurrentlyHidden(
                    attentionActions.get(
                        buildMissedWorkoutAlertKey(client.id, row.dateKey, row.workoutId)
                    ),
                    client.lastActiveAt
                )
        );

        if (missedWorkoutNeedsAttention) {
            clientsNeedingAttentionIds.add(client.id);
        }

        const needsAttention =
            missedWorkoutNeedsAttention
            || checkInNeedsAttention
            || setupNeedsAttention
            || unreadNeedsAttention;

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

        const hasOutstandingCheckInCovered = hasCheckInForOutstandingPeriod(
            getCheckInDueState(client.checkInSchedule, today),
            client.recentCheckInWeekNumbers
        );

        // Paused clients stay on the roster but shouldn't clutter upcoming attention surfaces.
        if (client.isCoachPaused) continue;

        for (let dayOffset = 0; dayOffset <= UPCOMING_LOOKAHEAD_DAYS; dayOffset++) {
            const dateKey = shiftDateKey(todayKey, dayOffset);
            const date = parseLogDate(dateKey);

            const plannedWorkoutRaw = getPlannedWorkoutForDate(activeUserPlan, date, { today });
            const plannedWorkout = isScheduledTrainingWorkout(plannedWorkoutRaw)
                ? plannedWorkoutRaw
                : null;
            const completedWorkoutKeys = completedWorkoutDateKeysByUser.get(client.id);
            const isWorkoutCompleted = plannedWorkout
                ? (completedWorkoutKeys?.has(`${plannedWorkout.id}:${dateKey}`) ?? false)
                : false;

            if (plannedWorkout && !isWorkoutCompleted) {
                upcomingEvents.push({
                    id: `${client.id}-workout-${dateKey}`,
                    clientId: client.id,
                    clientName: client.name,
                    type: "workout",
                    typeLabel: "Workout",
                    label: plannedWorkout.name,
                    dateKey,
                    dateLabel: formatUpcomingDateLabel(dateKey, todayKey),
                    href: `/coach/calendar?clientId=${client.id}&date=${dateKey}`,
                });
            }

            if (!hasOutstandingCheckInCovered && client.checkInSchedule) {
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
                        href: `/coach/client/${client.id}#client-check-ins`,
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

    const unreadTotal = Object.entries(unreadByPeer).reduce((sum, [clientId, count]) => {
        if (count <= 0) return sum;
        const client = activeClients.find((row) => row.id === clientId);
        if (
            isDismissedAlertCurrentlyHidden(
                attentionActions.get(buildUnreadMessageAlertKey(clientId)),
                client?.lastActiveAt ?? null
            )
        ) {
            return sum;
        }
        return sum + count;
    }, 0);
    const activeWorkoutsNow = Object.values(input.activeSessions).filter(Boolean).length;

    for (const clientId of input.pendingReviewClientIds) {
        clientsNeedingAttentionIds.add(clientId);
    }

    const attentionItems: CoachAttentionItem[] = [
        {
            key: "missed-workouts",
            label: "Missed yesterday's workouts",
            count: missedWorkoutsYesterdayCount,
            href: "/coach/missed-workouts",
            urgent: missedWorkoutsYesterdayCount > 0,
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

    const openAttentionItems = await loadCoachAttentionInboxOpenOnly(input.coachId);
    const attentionInboxPreview = openAttentionItems
        .slice(0, 3)
        .map((item) => `${item.clientName} · ${item.issueType}`);

    return {
        attentionItems,
        attentionInboxPreview,
        upcomingEvents,
        clientInsights,
        totals: {
            clientsNeedingAttention: openAttentionItems.length,
            pendingCheckIns: input.pendingReviewCount,
            unreadMessages: unreadTotal,
            activeWorkoutsNow,
            missedWorkoutsYesterday: missedWorkoutsYesterdayCount,
            overdueCheckIns,
            setupNeeded,
        },
    };
}

export async function getCoachUnreadMessageTotal(coachId: string, clientIds: string[]) {
    return getTotalUnreadDirectCount(coachId, clientIds);
}
