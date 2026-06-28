import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import {
    computeWeeklyCompliance,
    getMondayStart,
    type CalendarComplianceInput,
} from "@/lib/calendarCompliance";
import { getLocalTimeParts, shiftDateKey } from "@/lib/coachNotificationSchedule";
import { getUnreadCountsByPeer } from "@/lib/chatUnread";
import {
    buildCheckInAlertKey,
    buildFallingBehindAlertKey,
    buildMissedWorkoutAlertKey,
    buildPendingReviewAlertKey,
    buildSetupNeededAlertKey,
    buildUnreadMessageAlertKey,
    getCoachAttentionActions,
    getExcusedMissedWorkoutKeysForClient,
    type CoachAttentionActionType,
    type CoachAttentionCategory,
} from "@/lib/coachAttentionActions";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { loadPlanScheduleRevisionsByPlanIds } from "@/lib/planScheduleHistory";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { getWeekNumber, parseLogDate, toDateKey } from "@/lib/utils";

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
    actions: Map<string, { action: CoachAttentionActionType }>,
    alertKey: string
): "open" | CoachAttentionActionType {
    return actions.get(alertKey)?.action ?? "open";
}

function isAlertDismissed(
    actions: Map<string, { action: CoachAttentionActionType }>,
    alertKey: string
): boolean {
    return actions.get(alertKey)?.action === "dismissed";
}

const MISSED_LOOKBACK_DAYS = 7;
const INACTIVE_DAYS = 10;
const LOW_COMPLIANCE_PERCENT = 50;

export async function loadCoachAttentionInbox(coachId: string): Promise<CoachAttentionInboxItem[]> {
    const todayKey = getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey;
    const today = parseLogDate(todayKey);
    const weekNumber = getWeekNumber(today);
    const weekStart = getMondayStart(today);
    const lookbackStart = shiftDateKey(todayKey, -MISSED_LOOKBACK_DAYS);

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
                        status: "COMPLETED",
                        loggedAt: { gte: parseLogDate(lookbackStart) },
                    },
                    select: { workoutId: true, loggedAt: true },
                },
                checkIns: {
                    where: { weekNumber },
                    select: { id: true },
                    take: 1,
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
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const clientIds = clients.map((c) => c.id);
    const unreadCounts = clientIds.length > 0
        ? await getUnreadCountsByPeer(coachId, clientIds)
        : {};

    const planIds = [
        ...new Set(
            clients
                .map((c) => c.plans[0]?.plan.id)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const revisionsByPlanId = await loadPlanScheduleRevisionsByPlanIds(planIds);

    const items: CoachAttentionInboxItem[] = [];
    const inactiveCutoff = Date.now() - INACTIVE_DAYS * 86400000;

    for (const client of clients) {
        if (isInactiveAccount(client)) continue;

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

        const completedLogKeys = new Set(
            client.workoutLogs.map(
                (log) =>
                    `${getLocalTimeParts(log.loggedAt, APP_TIMEZONE).dateKey}:${log.workoutId}`
            )
        );

        if (activeUserPlan) {
            for (let offset = 1; offset <= MISSED_LOOKBACK_DAYS; offset++) {
                const dateKey = shiftDateKey(todayKey, -offset);
                const date = parseLogDate(dateKey);
                const planned = getPlannedWorkoutForDate(activeUserPlan, date, { today });
                if (!planned) continue;
                if (completedLogKeys.has(`${dateKey}:${planned.id}`)) continue;

                const alertKey = buildMissedWorkoutAlertKey(client.id, dateKey, planned.id);
                if (isAlertDismissed(actions, alertKey)) continue;

                items.push({
                    id: alertKey,
                    category: "missed_workout",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.missed_workout,
                    dateKey,
                    dateLabel: formatDateLabel(dateKey, todayKey),
                    explanation: `${clientName} did not complete ${planned.name} on ${formatDateLabel(dateKey, todayKey).toLowerCase()}.`,
                    status: getItemStatus(actions, alertKey),
                    urgent: offset === 1,
                    workoutId: planned.id,
                    workoutName: planned.name,
                    href: `/coach/client/${client.id}`,
                    chatHref,
                    calendarHref: `/coach/calendar?clientId=${client.id}&date=${dateKey}`,
                });
            }
        }

        const schedule = await getUserCheckInSchedule(client.id);
        const dueState = getCheckInDueState(schedule, today);
        const hasCheckInThisWeek = client.checkIns.length > 0;

        if (dueState.isConfigured && !hasCheckInThisWeek && (dueState.isOverdue || dueState.isDueToday)) {
            const alertKey = buildCheckInAlertKey(client.id, weekNumber);
            if (!isAlertDismissed(actions, alertKey)) {
                const category: CoachAttentionCategory = dueState.isOverdue
                    ? "check_in_overdue"
                    : "check_in_missed";
                items.push({
                    id: alertKey,
                    category,
                    clientId: client.id,
                    clientName,
                    issueType: dueState.isOverdue
                        ? ISSUE_LABELS.check_in_overdue
                        : ISSUE_LABELS.check_in_missed,
                    dateKey: todayKey,
                    dateLabel: dueState.isOverdue ? "Overdue" : "Due today",
                    explanation: dueState.isOverdue
                        ? `Weekly check-in was due on ${dueState.dueDayLabel ?? "schedule"} and has not been submitted.`
                        : `Weekly check-in is due today (${dueState.dueDayLabel ?? "scheduled day"}).`,
                    status: getItemStatus(actions, alertKey),
                    urgent: dueState.isOverdue,
                    weekNumber,
                    href: `/coach/client/${client.id}`,
                    chatHref,
                });
            }
        }

        if (!dueState.isConfigured) {
            const alertKey = buildSetupNeededAlertKey(client.id);
            if (!isAlertDismissed(actions, alertKey)) {
                items.push({
                    id: alertKey,
                    category: "setup_needed",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.setup_needed,
                    dateKey: todayKey,
                    dateLabel: "Now",
                    explanation: "Check-in schedule and onboarding setup are incomplete.",
                    status: getItemStatus(actions, alertKey),
                    urgent: true,
                    href: `/coach/client/${client.id}`,
                    chatHref,
                });
            }
        }

        const weekLogDates = client.workoutLogs
            .filter((log) => log.loggedAt >= weekStart)
            .map((log) => toDateKey(log.loggedAt));

        const complianceInput: CalendarComplianceInput = {
            activePlan: activeUserPlan ? { weeks: activeUserPlan.plan.weeks } : null,
            planStartedAt: activePlan?.startedAt.toISOString() ?? null,
            loggedDates: weekLogDates.map((date) => ({ date })),
            scheduleRevisions: activeUserPlan?.scheduleRevisions,
            excusedMissedWorkoutKeys: getExcusedMissedWorkoutKeysForClient(actions, client.id),
        };
        const compliance = computeWeeklyCompliance(complianceInput, today, {
            excludeTodayUntilLogged: true,
        });

        const isInactive = client.lastActiveAt
            ? client.lastActiveAt.getTime() < inactiveCutoff
            : true;
        const lowCompliance =
            compliance.percent != null && compliance.percent < LOW_COMPLIANCE_PERCENT;

        if (isInactive || lowCompliance) {
            const alertKey = buildFallingBehindAlertKey(client.id, weekNumber);
            if (!isAlertDismissed(actions, alertKey)) {
                items.push({
                    id: alertKey,
                    category: "falling_behind",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.falling_behind,
                    dateKey: todayKey,
                    dateLabel: "This week",
                    explanation: isInactive
                        ? `No app activity in ${INACTIVE_DAYS}+ days — client may need a check-in.`
                        : `Plan adherence is ${compliance.percent}% this week (below ${LOW_COMPLIANCE_PERCENT}%).`,
                    status: getItemStatus(actions, alertKey),
                    urgent: isInactive,
                    weekNumber,
                    href: `/coach/client/${client.id}`,
                    chatHref,
                });
            }
        }

        const unread = unreadCounts[client.id] ?? 0;
        if (unread > 0) {
            const alertKey = buildUnreadMessageAlertKey(client.id);
            if (!isAlertDismissed(actions, alertKey)) {
                items.push({
                    id: alertKey,
                    category: "unread_message",
                    clientId: client.id,
                    clientName,
                    issueType: ISSUE_LABELS.unread_message,
                    dateKey: todayKey,
                    dateLabel: "Recent",
                    explanation: `${unread} unread message${unread === 1 ? "" : "s"} waiting for your reply.`,
                    status: getItemStatus(actions, alertKey),
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
        if (isAlertDismissed(actions, alertKey)) continue;

        const clientName = checkIn.user.name ?? checkIn.user.email ?? "Client";
        items.push({
            id: alertKey,
            category: "pending_check_in",
            clientId: checkIn.user.id,
            clientName,
            issueType: ISSUE_LABELS.pending_check_in,
            dateKey: toDateKey(checkIn.createdAt),
            dateLabel: formatDateLabel(toDateKey(checkIn.createdAt), todayKey),
            explanation: `Week ${checkIn.weekNumber} check-in submitted and awaiting your review.`,
            status: getItemStatus(actions, alertKey),
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

    return items;
}

export async function loadCoachAttentionInboxOpenOnly(coachId: string) {
    const items = await loadCoachAttentionInbox(coachId);
    return items.filter((item) => item.status === "open");
}
