import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PlansClient } from "./PlansClient";
import { isCoachRole } from "@/lib/roles";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";
import { ensurePlanOriginalCreatorColumn } from "@/lib/planCreator";
import { ensurePlansShareCodes } from "@/lib/planShareCode";
import { getActiveAssigneesByPlanIdForCoach } from "@/lib/coachPlanAssignment";

export const metadata = { title: "Plans" };

function planCreatorName(plan: {
    originalCreator?: { name: string | null } | null;
    creator?: { name: string | null } | null;
}) {
    return plan.originalCreator?.name ?? plan.creator?.name ?? "Unknown";
}

export default async function PlansPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    await ensurePlanOriginalCreatorColumn();

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            plans: {
                include: {
                    plan: {
                        include: {
                            _count: { select: { weeks: true } },
                            creator: { select: { name: true } },
                            originalCreator: { select: { name: true } },
                            weeks: {
                                include: { _count: { select: { workouts: true } } },
                                take: 1,
                                orderBy: { weekNumber: "asc" },
                            },
                        },
                    },
                },
                orderBy: { startedAt: "desc" },
            },
        },
    });

    if (!user) redirect("/onboarding");

    let activeSession: {
        id: string;
        workoutId: string;
        workoutName: string;
        loggedAt: string;
    } | null = null;

    if (!isCoachRole(user.role)) {
        await cleanupStaleInProgressSessions(user.id);

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const inProgressLog = await prisma.workoutLog.findFirst({
            where: {
                userId: user.id,
                status: "IN_PROGRESS",
                updatedAt: { gte: twentyFourHoursAgo },
            },
            include: { workout: true },
            orderBy: { updatedAt: "desc" },
        });

        if (inProgressLog?.workout) {
            activeSession = {
                id: inProgressLog.id,
                workoutId: inProgressLog.workoutId,
                workoutName: inProgressLog.workout.name,
                loggedAt: inProgressLog.loggedAt.toISOString(),
            };
        }
    }

    let plans;

    if (isCoachRole(user.role)) {
        const [created, assigneesByPlanId] = await Promise.all([
            prisma.plan.findMany({
                where: { creatorId: user.id },
                include: {
                    _count: { select: { weeks: true } },
                    creator: { select: { name: true } },
                    originalCreator: { select: { name: true } },
                    weeks: {
                        include: { _count: { select: { workouts: true } } },
                        take: 1,
                        orderBy: { weekNumber: "asc" },
                    },
                },
                orderBy: { updatedAt: "desc" },
            }),
            getActiveAssigneesByPlanIdForCoach(user.id),
        ]);

        plans = created.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            type: plan.type,
            shareCode: plan.shareCode,
            creatorName: planCreatorName(plan),
            isOwned: true,
            isActive: false,
            isPublic: plan.isPublic,
            weekCount: plan._count.weeks,
            startedAt: plan.createdAt.toISOString(),
            tags: plan.tags,
            assignedClient: assigneesByPlanId.get(plan.id) ?? null,
        }));
    } else {
        plans = user.plans.map((up) => ({
            id: up.plan.id,
            name: up.plan.name,
            description: up.plan.description,
            type: up.plan.type,
            shareCode: up.plan.shareCode,
            creatorName: planCreatorName(up.plan),
            isOwned: up.plan.creatorId === user.id,
            isActive: up.isActive,
            isPublic: up.plan.creatorId === user.id ? up.plan.isPublic : false,
            weekCount: up.plan._count.weeks,
            startedAt: up.startedAt.toISOString(),
            tags: up.plan.tags,
        }));
    }

    const shareCodes = await ensurePlansShareCodes(plans.map((plan) => plan.id));
    plans = plans.map((plan) => ({
        ...plan,
        shareCode: shareCodes.get(plan.id) ?? plan.shareCode,
    }));

    return (
        <>
            <TopBar title="Plans" subtitle="Manage your workout programmes" />
            <div className="p-6 max-w-5xl mx-auto">
                <Suspense fallback={<div className="min-h-[200px] animate-pulse rounded-xl bg-surface-muted" />}>
                    <PlansClient plans={plans} userRole={user.role} activeSession={activeSession} />
                </Suspense>
            </div>
        </>
    );
}
