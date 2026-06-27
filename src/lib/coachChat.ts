import { prisma } from "@/lib/prisma";
import { createNotification, notifyClientOfCoachMessage, userWantsNotification } from "@/lib/notifications";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import type { User } from "@prisma/client";

export type ChatActionType = "PLAN_ASSIGNED" | "CHECKIN_REQUEST" | "BROADCAST";

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

export async function assignPlanToClient(clientId: string, planId: string) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plan not found");

    await prisma.$transaction(async (tx) => {
        await tx.userPlan.updateMany({
            where: { userId: clientId },
            data: { isActive: false },
        });

        const existing = await tx.userPlan.findUnique({
            where: { userId_planId: { userId: clientId, planId } },
        });

        if (existing) {
            await tx.userPlan.update({
                where: { id: existing.id },
                data: { isActive: true },
            });
        } else {
            await tx.userPlan.create({
                data: { userId: clientId, planId, isActive: true },
            });
        }
    });

    return plan;
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
            await notifyClientOfCoachMessage({
                clientUserId: client.id,
                coachId: input.coach.id,
                coachName: input.coach.name ?? input.coach.email ?? "Your coach",
                route: `/chat?with=${input.coach.id}`,
            });
        }
    }

    return message;
}

export async function sendPlanViaChat(coach: User, clientId: string, planId: string, note?: string) {
    const editCheck = await requireCoachCanEditClient(coach, clientId);
    if (editCheck.error) throw new Error("Forbidden");

    const plan = await assignPlanToClient(clientId, planId);

    if (await userWantsNotification(clientId, "notifyOnPlanUpdate")) {
        await createNotification({
            userId: clientId,
            type: "PLAN_UPDATED",
            message: "Your coach assigned you a new plan",
            entityType: "PLAN",
            entityId: plan.id,
            route: `/plans?highlight=${plan.id}`,
        });
    }

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

export async function sendCheckInRequestViaChat(coach: User, clientId: string, note?: string) {
    const editCheck = await requireCoachCanEditClient(coach, clientId);
    if (editCheck.error) throw new Error("Forbidden");

    const content = note?.trim()
        || "Your coach requested a check-in. Please submit your weekly check-in when you're ready.";

    await createNotification({
        userId: clientId,
        type: "MISSED_CHECKIN",
        message: "Your coach requested a check-in",
        entityType: "CHECKIN",
        entityId: null,
        route: "/checkins",
    });

    return createCoachDirectMessage({
        coach,
        clientId,
        content,
        actionType: "CHECKIN_REQUEST",
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
        targetIds = await getCoachClientIds(coach.id, coach.role);
    } else {
        const where = coach.role === "SUPER_ADMIN"
            ? {
                id: { in: targetIds },
                isDeleted: false,
                isDeactivated: false,
                role: { in: ["FREE", "PREMIUM"] as const },
            }
            : {
                id: { in: targetIds },
                coachId: coach.id,
                isDeleted: false,
                isDeactivated: false,
            };
        const allowed = await prisma.user.findMany({
            where,
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

export async function getCoachClientIds(coachId: string, role: string) {
    if (role === "SUPER_ADMIN") {
        const users = await prisma.user.findMany({
            where: {
                id: { not: coachId },
                isDeleted: false,
                isDeactivated: false,
                role: { in: ["FREE", "PREMIUM"] },
            },
            select: { id: true },
        });
        return users.map((user) => user.id);
    }

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
