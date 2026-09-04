import { prisma } from "@/lib/prisma";
import { notifyClientOfCheckInRequest, notifyClientOfCoachBroadcast, notifyClientOfCoachMessage, notifyClientOfMissedWorkout, notifyClientOfPlanAssigned } from "@/lib/notifications";
import { NOTIFICATION_TYPES, QUICK_REPLY_TEMPLATES } from "@/lib/notificationTypes";
import { assignCoachPlanToClient } from "@/lib/coachPlanAssignment";
import type { User } from "@prisma/client";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getEffectiveCheckInDueStateForUser } from "@/lib/coachAttentionActions";
import { formatCheckInDueDate } from "@/lib/checkInLabels";

export type ChatActionType = "PLAN_ASSIGNED" | "CHECKIN_REQUEST" | "MISSED_WORKOUT" | "BROADCAST" | "ACCESS_REQUEST";

/** Chat rows with these action types carry their own notification — not a generic DM alert. */
const CHAT_ACTIONS_WITH_DEDICATED_NOTIFY = new Set<ChatActionType>([
    "BROADCAST",
    "CHECKIN_REQUEST",
    "MISSED_WORKOUT",
    "PLAN_ASSIGNED",
    "ACCESS_REQUEST",
]);

let messageActionColumnsReady = false;

export async function ensureMessageActionColumns() {
    if (messageActionColumnsReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "actionType" TEXT
    `;
    await prisma.$executeRaw`
        ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "actionEntityId" TEXT
    `;

    messageActionColumnsReady = true;
}

export async function assignPlanToClient(coachId: string, clientId: string, planId: string) {
    const result = await assignCoachPlanToClient({ coachId, clientId, planId });
    return result.plan;
}

async function requireOwnActiveClient(coach: Pick<User, "id">, clientId: string) {
    const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, email: true, coachId: true, isDeleted: true, isDeactivated: true },
    });
    if (!client || client.coachId !== coach.id || client.isDeleted || client.isDeactivated) {
        throw new Error("Forbidden");
    }

    return client;
}

function firstName(name: string | null | undefined, fallback = "there") {
    const value = name?.trim();
    if (!value) return fallback;
    return value.split(/\s+/)[0] || fallback;
}

async function buildGeneratedCheckInReminder(client: Awaited<ReturnType<typeof requireOwnActiveClient>>) {
    const name = firstName(client.name ?? client.email);
    const schedule = await getUserCheckInSchedule(client.id);
    const dueState = await getEffectiveCheckInDueStateForUser(client.id, schedule, new Date());
    const dueLabel = formatCheckInDueDate(dueState.currentPeriodDueDate ?? dueState.nextDueDate);

    if (dueState.isOverdue) {
        return `Hi ${name}, quick reminder that your check-in is overdue${dueLabel ? ` from ${dueLabel}` : ""}. Please send it through when you can so I can review how training, recovery, and weight are moving.`;
    }

    if (dueState.isDueToday) {
        return `Hi ${name}, your check-in is due today${dueLabel ? ` (${dueLabel})` : ""}. Send it through when you get a chance so I can review your week properly.`;
    }

    return `Hi ${name}, can you send over your latest check-in when you get a chance? Include how training felt, recovery, and anything you want me to look at.`;
}

export async function createCoachDirectMessage(input: {
    coach: User;
    clientId: string;
    content: string;
    actionType?: ChatActionType;
    actionEntityId?: string;
}) {
    await ensureMessageActionColumns();

    const message = await prisma.message.create({
        data: {
            senderId: input.coach.id,
            receiverId: input.clientId,
            content: input.content,
            isGeneral: false,
            type: "TEXT",
            status: "SENT",
            actionType: input.actionType ?? null,
            actionEntityId: input.actionEntityId ?? null,
        },
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true, isDeleted: true, deletedName: true } },
            replyTo: {
                select: {
                    id: true,
                    content: true,
                    type: true,
                    sender: { select: { id: true, name: true } },
                },
            },
            reactions: {
                select: {
                    id: true,
                    emoji: true,
                    userId: true,
                    user: { select: { id: true, name: true } },
                },
            },
        },
    });

    if (["COACH", "SUPER_ADMIN"].includes(input.coach.role)) {
        const client = await prisma.user.findUnique({
            where: { id: input.clientId },
            select: { id: true, coachId: true },
        });
        if (client && (input.coach.role === "SUPER_ADMIN" || client.coachId === input.coach.id)) {
            const notifyInput = {
                clientUserId: client.id,
                coachId: input.coach.id,
                coachName: input.coach.name ?? input.coach.email ?? "Your coach",
                senderRole: input.coach.role,
                route: `/chat?with=${input.coach.id}`,
            };
            if (input.actionType === "BROADCAST") {
                await notifyClientOfCoachBroadcast(notifyInput);
            } else if (!input.actionType || !CHAT_ACTIONS_WITH_DEDICATED_NOTIFY.has(input.actionType)) {
                await notifyClientOfCoachMessage(notifyInput);
            }
        }
    }

    return message;
}

export async function sendPlanViaChat(coach: User, clientId: string, planId: string, note?: string) {
    await requireOwnActiveClient(coach, clientId);

    const plan = await assignPlanToClient(coach.id, clientId, planId);

    await notifyClientOfPlanAssigned({
        clientUserId: clientId,
        coachId: coach.id,
        coachName: coach.name ?? coach.email ?? "Your coach",
        planId: plan.id,
        planName: plan.name,
    });

    const content = note?.trim()
        || `Your coach assigned you a new training plan: ${plan.name}`;

    return createCoachDirectMessage({
        coach,
        clientId,
        content,
        actionType: "PLAN_ASSIGNED",
        actionEntityId: plan.id,
    });
}

export async function sendCheckInRequestViaChat(
    coach: User,
    clientId: string,
    note?: string,
    options?: { weekNumber?: number; periodDueDateKey?: string | null; skipChat?: boolean }
) {
    const client = await requireOwnActiveClient(coach, clientId);

    const content = note?.trim()
        || await buildGeneratedCheckInReminder(client);

    if (options?.weekNumber != null) {
        const { upsertCheckInRequest } = await import("@/lib/checkInRequests");
        await upsertCheckInRequest({
            coachId: coach.id,
            clientId,
            weekNumber: options.weekNumber,
            periodDueDateKey: options.periodDueDateKey ?? null,
            enforceCooldown: true,
        });
    }

    await notifyClientOfCheckInRequest({
        clientUserId: clientId,
        coachId: coach.id,
        coachName: coach.name,
        weekNumber: options?.weekNumber,
        message:
            options?.weekNumber != null
                ? `Check-in requested\n${coach.name?.trim() || "Your coach"} has asked you to complete your overdue check-in.`
                : content,
    });

    if (options?.skipChat) {
        return null;
    }

    return createCoachDirectMessage({
        coach,
        clientId,
        content,
        actionType: "CHECKIN_REQUEST",
    });
}

export async function sendMissedWorkoutNotifyViaChat(
    coach: User,
    clientId: string,
    input?: { message?: string; workoutId?: string | null }
) {
    await requireOwnActiveClient(coach, clientId);

    const content =
        input?.message?.trim()
        ?? QUICK_REPLY_TEMPLATES[NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT];

    await notifyClientOfMissedWorkout({
        clientUserId: clientId,
        coachId: coach.id,
        message: content,
        workoutId: input?.workoutId ?? null,
    });

    return createCoachDirectMessage({
        coach,
        clientId,
        content,
        actionType: "MISSED_WORKOUT",
        actionEntityId: input?.workoutId ?? null,
    });
}

export async function broadcastCoachMessage(
    coach: User,
    input: { clientIds?: string[]; content: string }
) {
    const content = input.content.trim();
    if (!content) throw new Error("Message is required");

    let targetIds = input.clientIds ?? [];
    if (targetIds.length === 0) {
        targetIds = await getCoachClientIds(coach.id);
    } else {
        const allowed = await prisma.user.findMany({
            where: {
                id: { in: targetIds },
                coachId: coach.id,
                isDeleted: false,
                isDeactivated: false,
            },
            select: { id: true },
        });
        targetIds = allowed.map((client) => client.id);
    }

    if (targetIds.length === 0) throw new Error("No clients to message");

    const sent: string[] = [];
    for (const clientId of targetIds) {
        await createCoachDirectMessage({
            coach,
            clientId,
            content,
            actionType: "BROADCAST",
        });
        sent.push(clientId);
    }

    return { sentCount: sent.length, clientIds: sent };
}

export async function getActiveSessionsForClients(clientIds: string[]) {
    if (clientIds.length === 0) return {};

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await prisma.workoutLog.findMany({
        where: {
            userId: { in: clientIds },
            status: "IN_PROGRESS",
            updatedAt: { gte: twentyFourHoursAgo },
        },
        include: { workout: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
    });

    const sessions: Record<string, { workoutName: string; logId: string; workoutId: string }> = {};
    for (const log of logs) {
        if (sessions[log.userId]) continue;
        sessions[log.userId] = {
            workoutName: log.workout.name,
            logId: log.id,
            workoutId: log.workoutId,
        };
    }

    return sessions;
}

export async function getCoachClientIds(coachId: string) {
    const clients = await prisma.user.findMany({
        where: {
            coachId,
            isDeleted: false,
            isDeactivated: false,
        },
        select: { id: true },
    });
    return clients.map((client) => client.id);
}
