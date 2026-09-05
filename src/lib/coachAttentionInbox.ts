import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import { getUnreadCountsByPeer } from "@/lib/chatUnread";
import {
    buildCheckInAlertKey,
    buildMissedWorkoutAlertKey,
    buildPendingReviewAlertKey,
    buildSetupNeededAlertKey,
    buildUnreadMessageAlertKey,
    getCoachAttentionActions,
    getEffectiveCheckInDueStatesForUsers,
    getExcusedMissedWorkoutKeysForClient,
    isDismissedAlertCurrentlyHidden,
    type CoachAttentionActionRow,
    type CoachAttentionActionType,
    type CoachAttentionCategory,
} from "@/lib/coachAttentionActions";
import {
    COACH_MISSED_WORKOUT_LOOKBACK_DAYS,
    listLookbackScheduledWorkoutSlots,
    logSlotKey,
} from "@/lib/coachMissedScheduledWorkouts";
import { type ActiveUserPlanLike } from "@/lib/planSchedule";
import { loadHistoricalMissedSessionsByUserIds } from "@/lib/planMissedSessionHistory";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { isInactiveAccount } from "@/lib/userDeactivation";
import {
    getCoachPauseStatusMap,
} from "@/lib/coachClientPause";
import { formatCheckInDueDate, formatCheckInWeekFromCheckIn } from "@/lib/checkInLabels";
import {
    getCoachAppToday,
    isCoachClientCheckInDueForFilter,
} from "@/lib/coachOverdueCheckIns";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { loadNicknameMap } from "@/lib/userNicknames";

export interface CoachAttentionInboxItem {
    id: string;
    category: CoachAttentionCategory;
    clientId: string;
    clientName: string;
    issueType: string;
    dateKey: string;
    dateLabel: string;
    explanation: string;
    status: "open" | CoachAttentionActionType;
    urgent: boolean;
    checkInId?: string;
    workoutId?: string;
    workoutName?: string;
    weekNumber?: number;
    unreadCount?: number;
    href: string;
    chatHref: string;
    calendarHref?: string;
}

const ISSUE_LABELS: Record<CoachAttentionCategory, string> = {
    missed_workout: "Missed workout",
    check_in_overdue: "Overdue check-in",
    check_in_missed: "Missed check-in",
    pending_check_in: "Pending review",
    unread_message: "Unread message",
    setup_needed: "Setup needed",
    falling_behind: "Falling behind",
};

function formatDateLabel(dateKey: string, todayKey: string): string {
    if (dateKey === todayKey) return "Today";
    if (dateKey === shiftDateKey(todayKey, -1)) return "Yesterday";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
    }).format(date);
}

function getItemStatus(
    actions: Map<string, CoachAttentionActionRow>,
    alertKey: string,
    clientLastActiveAt: Date | null | undefined,
    now = new Date()
): "open" | CoachAttentionActionType {
    const action = actions.get(alertKey);
    if (isDismissedAlertCurrentlyHidden(action, clientLastActiveAt, now)) {
        return "dismissed";
    }
    if (action?.action === "excused") return "excused";
    return "open";
}

function isAlertDismissed(
    actions: Map<string, CoachAttentionActionRow>,
    alertKey: string,
    clientLastActiveAt: Date | null | undefined,
    now = new Date()
): boolean {
    return isDismissedAlertCurrentlyHidden(actions.get(alertKey), clientLastActiveAt, now);
}

export async function loadCoachAttentionInbox(coachId: string): Promise<CoachAttentionInboxItem[]> {
    const { today, todayKey, weekNumber } = getCoachAppToday();
    const lookbackStart = shiftDateKey(todayKey, -COACH_MISSED_WORKOUT_LOOKBACK_DAYS);

    const [clients, actions, pendingReviews] = await Promise.all([
        prisma.user.findMany({
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
                lastActiveAt: true,
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
                            { status: "COMPLETED", loggedAt: { gte: parseLogDate(lookbackStart) } },
                            { status: "IN_PROGRESS" },
                        ],
                    },
                    select: { workoutId: true, loggedAt: true, status: true },
                },
            },
            orderBy: { name: "asc" },
        }),
        getCoachAttentionActions(coachId),
        prisma.checkIn.findMany({
            where: {
                status: "PENDING",
                user: { coachId, isDeleted: false, isDeactivated: false },
            },
            include: { user: { select: { id: true, name: true, email: true, lastActiveAt: true } } },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const clientIds = clients.map((c) => c.id);
    const [unreadCounts, pauseStatusByClient, dueStates, historicalMissedByUserId] = await Promise.all([
        clientIds.length > 0
            ? getUnreadCountsByPeer(coachId, clientIds)
            : Promise.resolve({} as Record<string, number>),
        getCoachPauseStatusMap(clientIds),
        getEffectiveCheckInDueStatesForUsers(clientIds, today),
        loadHistoricalMissedSessionsByUserIds(clientIds),
    ]);

    const planIds = [
        ...new Set(
            clients
                .map((c) => c.plans[0]?.plan.id)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const items: CoachAttentionInboxItem[] = [];

    const now = new Date();

    for (const client of clients) {
        if (isInactiveAccount(client)) continue;

        const pauseStatus = pauseStatusByClient.get(client.id);
        const isPaused = Boolean(pauseStatus?.isCoachPaused);
        const pauseClient = {
            isCoachPaused: pauseStatus?.isCoachPaused ?? false,
            coachResumedAt: pauseStatus?.coachResumedAt ?? null,
        };

        const clientLastActiveAt = client.lastActiveAt;
        const clientName = client.name ?? client.email ?? "Client";
        const chatHref = `/chat?with=${client.id}`;
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

        const lookbackSlots = listLookbackScheduledWorkoutSlots({
            today,
            todayKey,
            activeUserPlan,
            completedLogKeys,
            inProgressLogKeys,
            excusedKeys: new Set(getExcusedMissedWorkoutKeysForClient(actions, client.id)),
            pauseClient,
            historicalMissedSessions: historicalMissedByUserId.get(client.id) ?? [],
        });

        for (const slot of lookbackSlots) {
            if (slot.status !== "missed" && slot.status !== "excused") continue;
            const alertKey = buildMissedWorkoutAlertKey(client.id, slot.dateKey, slot.workoutId);
            if (slot.status === "missed" && isAlertDismissed(actions, alertKey, clientLastActiveAt, now)) {
                continue;
            }

            items.push({
                id: alertKey,
                category: "missed_workout",
                clientId: client.id,
                clientName,
                issueType: ISSUE_LABELS.missed_workout,
                dateKey: slot.dateKey,
                dateLabel: formatDateLabel(slot.dateKey, todayKey),
                explanation: `${clientName} did not complete ${slot.workoutName} on ${formatDateLabel(slot.dateKey, todayKey).toLowerCase()}.`,
                status: slot.status === "excused"
                    ? "excused"
                    : getItemStatus(actions, alertKey, clientLastActiveAt, now),
                urgent: slot.dateKey === shiftDateKey(todayKey, -1),
                workoutId: slot.workoutId,
                workoutName: slot.workoutName,
                href: `/coach/client/${client.id}`,
                chatHref,
                calendarHref: `/coach/calendar?clientId=${client.id}&date=${slot.dateKey}`,
            });
        }

        const dueState = dueStates.get(client.id);

        if (dueState && isCoachClientCheckInDueForFilter(dueState, pauseClient)) {
            const periodWeek = dueState.outstandingWeekNumber ?? weekNumber;
            const alertKey = buildCheckInAlertKey(client.id, periodWeek);
            const category: CoachAttentionCategory = dueState.isOverdue
                ? "check_in_overdue"
                : "check_in_missed";
            const daysOverdue = dueState.daysOverdue;
            items.push({
                id: alertKey,
                category,
                clientId: client.id,
                clientName,
                issueType: dueState.isOverdue
                    ? ISSUE_LABELS.check_in_overdue
                    : ISSUE_LABELS.check_in_missed,
                dateKey: todayKey,
                dateLabel: dueState.isOverdue
                    ? (daysOverdue != null && daysOverdue > 1
                        ? `${daysOverdue} days overdue`
                        : "Overdue")
                    : "Due today",
                explanation: dueState.isOverdue
                    ? `Weekly check-in was due ${formatCheckInDueDate(dueState.currentPeriodDueDate) ?? "on schedule"}${daysOverdue != null ? ` (${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue)` : ""} and has not been submitted.`
                    : `Weekly check-in is due today${formatCheckInDueDate(dueState.currentPeriodDueDate) ? ` · ${formatCheckInDueDate(dueState.currentPeriodDueDate)}` : ""}.`,
                status: getItemStatus(actions, alertKey, clientLastActiveAt, now),
                urgent: dueState.isOverdue,
                weekNumber: periodWeek,
                href: `/coach/client/${client.id}`,
                chatHref,
            });
        }

        if (!isPaused && !dueState?.isConfigured) {
            const alertKey = buildSetupNeededAlertKey(client.id);
            if (!isAlertDismissed(actions, alertKey, clientLastActiveAt, now)) {
                items.push({
                    id: alertKey,
                    category: "setup_needed",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.setup_needed,
                    dateKey: todayKey,
                    dateLabel: "Now",
                    explanation: "Check-in schedule and onboarding setup are incomplete.",
                    status: getItemStatus(actions, alertKey, clientLastActiveAt, now),
                    urgent: true,
                    href: `/coach/client/${client.id}`,
                    chatHref,
                });
            }
        }

        const unread = unreadCounts[client.id] ?? 0;
        if (unread > 0) {
            const alertKey = buildUnreadMessageAlertKey(client.id);
            if (!isAlertDismissed(actions, alertKey, clientLastActiveAt, now)) {
                items.push({
                    id: alertKey,
                    category: "unread_message",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.unread_message,
                    dateKey: todayKey,
                    dateLabel: "Recent",
                    explanation: `${unread} unread message${unread === 1 ? "" : "s"} waiting for your reply.`,
                    status: getItemStatus(actions, alertKey, clientLastActiveAt, now),
                    urgent: unread >= 3,
                    unreadCount: unread,
                    href: chatHref,
                    chatHref,
                });
            }
        }
    }

    for (const checkIn of pendingReviews) {
        const alertKey = buildPendingReviewAlertKey(checkIn.id);
        const reviewLastActiveAt = checkIn.user.lastActiveAt ?? null;
        if (isAlertDismissed(actions, alertKey, reviewLastActiveAt, now)) continue;

        const clientName = checkIn.user.name ?? checkIn.user.email ?? "Client";
        items.push({
            id: alertKey,
            category: "pending_check_in",
            clientId: checkIn.user.id,
            clientName,
            issueType: ISSUE_LABELS.pending_check_in,
            dateKey: toDateKey(checkIn.createdAt),
            dateLabel: formatDateLabel(toDateKey(checkIn.createdAt), todayKey),
            explanation: `${formatCheckInWeekFromCheckIn(checkIn)} submitted and awaiting your review.`,
            status: getItemStatus(actions, alertKey, reviewLastActiveAt, now),
            urgent: false,
            checkInId: checkIn.id,
            weekNumber: checkIn.weekNumber,
            href: `/checkins?highlight=${checkIn.id}`,
            chatHref: `/chat?with=${checkIn.user.id}`,
        });
    }

    items.sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        if (a.status === "open" && b.status !== "open") return -1;
        if (b.status === "open" && a.status !== "open") return 1;
        return b.dateKey.localeCompare(a.dateKey);
    });

    const nicknameMap = await loadNicknameMap(coachId, items.map((item) => item.clientId));
    if (nicknameMap.size === 0) return items;

    return items.map((item) => {
        const nick = nicknameMap.get(item.clientId);
        return nick ? { ...item, clientName: nick } : item;
    });
}

export async function loadCoachAttentionInboxOpenOnly(coachId: string) {
    const items = await loadCoachAttentionInbox(coachId);
    return items.filter((item) => item.status === "open");
}
