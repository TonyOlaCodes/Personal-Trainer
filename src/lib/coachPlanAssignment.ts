import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clonePlanForUser } from "@/lib/planClone";

export interface CoachPlanAssignee {
    id: string;
    name: string;
}

export interface CoachPlanAssignmentResult {
    plan: Plan;
    assignedPlanId: string;
    cloned: boolean;
}

/** Active client (other than excludeClientId) currently on this plan for this coach. */
export async function findOtherActiveAssigneeForCoachPlan(
    planId: string,
    coachId: string,
    excludeClientId: string
) {
    return prisma.userPlan.findFirst({
        where: {
            planId,
            isActive: true,
            userId: { not: excludeClientId },
            user: {
                coachId,
                isDeleted: false,
                isDeactivated: false,
            },
        },
        select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
        },
    });
}

export async function getActiveAssigneesByPlanIdForCoach(
    coachId: string
): Promise<Map<string, CoachPlanAssignee>> {
    const rows = await prisma.userPlan.findMany({
        where: {
            isActive: true,
            plan: { creatorId: coachId },
            user: {
                coachId,
                isDeleted: false,
                isDeactivated: false,
            },
        },
        select: {
            planId: true,
            user: { select: { id: true, name: true, email: true } },
        },
    });

    const map = new Map<string, CoachPlanAssignee>();
    for (const row of rows) {
        map.set(row.planId, {
            id: row.user.id,
            name: row.user.name ?? row.user.email ?? "Client",
        });
    }
    return map;
}

function clientDisplayName(name: string | null | undefined, email: string | null | undefined) {
    return name?.trim() || email || "Client";
}

/** If another client already has this plan, clone it for the new assignee. */
export async function resolveCoachPlanForClientAssignment(input: {
    coachId: string;
    clientId: string;
    planId: string;
    allowAnyCoachPlan?: boolean;
    clientName?: string | null;
    clientEmail?: string | null;
}): Promise<{ planId: string; cloned: boolean }> {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new Error("Plan not found");

    if (!input.allowAnyCoachPlan && plan.creatorId !== input.coachId) {
        throw new Error("You can only assign plans you created");
    }

    const otherAssignee = await findOtherActiveAssigneeForCoachPlan(
        input.planId,
        input.coachId,
        input.clientId
    );
    if (!otherAssignee) {
        return { planId: input.planId, cloned: false };
    }

    let label = clientDisplayName(input.clientName, input.clientEmail);
    if (!input.clientName && !input.clientEmail) {
        const client = await prisma.user.findUnique({
            where: { id: input.clientId },
            select: { name: true, email: true },
        });
        label = clientDisplayName(client?.name, client?.email);
    }

    const cloned = await clonePlanForUser(input.planId, input.coachId, {
        name: `${plan.name} (${label})`,
        type: "COACH_ASSIGNED",
    });
    if (!cloned) throw new Error("Could not create a copy of this plan");

    return { planId: cloned.id, cloned: true };
}

/** Assign a plan to a client — auto-clones when another client already has that plan active. */
export async function assignCoachPlanToClient(input: {
    coachId: string;
    clientId: string;
    planId: string;
    allowAnyCoachPlan?: boolean;
}): Promise<CoachPlanAssignmentResult> {
    const client = await prisma.user.findUnique({
        where: { id: input.clientId },
        select: { name: true, email: true },
    });

    const { planId: resolvedPlanId, cloned } = await resolveCoachPlanForClientAssignment({
        ...input,
        clientName: client?.name,
        clientEmail: client?.email,
    });

    await prisma.$transaction(async (tx) => {
        await tx.userPlan.updateMany({
            where: { userId: input.clientId },
            data: { isActive: false },
        });

        const existing = await tx.userPlan.findUnique({
            where: { userId_planId: { userId: input.clientId, planId: resolvedPlanId } },
        });

        if (existing) {
            await tx.userPlan.update({
                where: { id: existing.id },
                data: { isActive: true, startedAt: new Date() },
            });
        } else {
            await tx.userPlan.create({
                data: {
                    userId: input.clientId,
                    planId: resolvedPlanId,
                    isActive: true,
                },
            });
        }

        if (!cloned) {
            await tx.plan.update({
                where: { id: resolvedPlanId },
                data: { type: "COACH_ASSIGNED" },
            });
        }
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: resolvedPlanId } });
    return { plan, assignedPlanId: resolvedPlanId, cloned };
}
