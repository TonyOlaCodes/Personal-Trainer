import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
    updatePlanPreservingHistory,
    type PlanPatchPayload,
} from "@/lib/planUpdate";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { countWorkoutLogsForPlan, DataSafetyError } from "@/lib/dataSafety";
import { isInactiveAccount } from "@/lib/userDeactivation";

interface PlanExercisePayload {
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
    order?: number | null;
    muscleGroup?: string | null;
}

interface PlanWorkoutPayload {
    dayNumber: number;
    dayOfWeek?: number | null;
    name: string;
    notes?: string | null;
    exercises: PlanExercisePayload[];
}

interface PlanWeekPayload {
    weekNumber: number;
    name?: string | null;
    workouts: PlanWorkoutPayload[];
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    await ensureDbSchema();
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
            creator: { select: { name: true } },
            weeks: {
                orderBy: { weekNumber: "asc" },
                include: {
                    workouts: {
                        where: activeWorkoutWhere(),
                        orderBy: { dayNumber: "asc" },
                        include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
                    },
                },
            },
        },
    });

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Auth check: Creator, Admin, or the Coach of whoever is assigned this plan
    const isOwner = plan.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";
    
    if (!isOwner && !isAdmin) {
        // Check if any user assigned this plan is a client of the requester
        const isCoachOfAssignee = await prisma.userPlan.findFirst({
            where: { 
                planId: plan.id,
                user: { coachId: user.id }
            }
        });

        // Also check if the requester is the person assigned the plan
        const isAssignee = await prisma.userPlan.findFirst({
            where: { planId: plan.id, userId: user.id }
        });

        if (!isCoachOfAssignee && !isAssignee) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    return NextResponse.json(plan);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json() as PlanPatchPayload;
    const { name, description, weeks } = body;

    const existing = await prisma.plan.findUnique({
        where: { id: planId },
        select: { creatorId: true }
    });

    if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const isOwner = existing.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";
    
    if (!isOwner && !isAdmin) {
        // Allow coach to edit if they are the coach of the person with this plan
        const isCoachOfAssignee = await prisma.userPlan.findFirst({
            where: { 
                planId: planId,
                user: { coachId: user.id }
            }
        });
        // Allow client to edit if the plan is assigned to them
        const isAssignee = await prisma.userPlan.findFirst({
            where: {
                planId: planId,
                userId: user.id
            }
        });
        if (!isCoachOfAssignee && !isAssignee) {
            return NextResponse.json({ error: "Unauthorized to edit" }, { status: 403 });
        }
        if (isCoachOfAssignee && !isAssignee) {
            const activeAssignment = await prisma.userPlan.findFirst({
                where: {
                    planId,
                    user: {
                        coachId: user.id,
                        isDeleted: false,
                        isDeactivated: false,
                    },
                },
            });
            if (!activeAssignment) {
                return NextResponse.json(
                    { error: "This plan is linked to an inactive account and cannot be edited" },
                    { status: 403 }
                );
            }
        }
    }

    try {
        const updatedPlan = await updatePlanPreservingHistory(planId, name, description, weeks);

        const assignedUsers = await prisma.userPlan.findMany({
            where: { planId, isActive: true },
            select: { userId: true },
        });
        await Promise.all(assignedUsers.map((assignment) => createNotification({
            userId: assignment.userId,
            type: "PLAN_UPDATED",
            message: "Your plan has been updated",
            entityType: "PLAN",
            entityId: planId,
            route: `/plans?highlight=${planId}`,
        })));

        return NextResponse.json(updatedPlan);
    } catch (err: unknown) {
        console.error("Plan Update Error:", err);
        const message = err instanceof Error ? err.message : "Failed to edit plan";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const isOwner = plan.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";

    if (isOwner || isAdmin) {
        const logCount = await countWorkoutLogsForPlan(planId);
        if (logCount > 0) {
            return NextResponse.json({ error: DataSafetyError.planHasHistory }, { status: 409 });
        }
        await prisma.plan.delete({ where: { id: planId } });
        return NextResponse.json({ success: true, removed: "deleted" });
    }

    const assignment = await prisma.userPlan.findUnique({
        where: { userId_planId: { userId: user.id, planId } },
    });

    if (!assignment) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.userPlan.delete({
        where: { userId_planId: { userId: user.id, planId } },
    });

    return NextResponse.json({ success: true, removed: "unlinked" });
}
