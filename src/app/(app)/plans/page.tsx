import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PlansClient } from "./PlansClient";
import { isCoachRole } from "@/lib/roles";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            plans: {
                include: {
                    plan: {
                        include: {
                            _count: { select: { weeks: true } },
                            creator: { select: { name: true } },
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
        const created = await prisma.plan.findMany({
            where: { creatorId: user.id },
            include: {
                _count: { select: { weeks: true } },
                creator: { select: { name: true } },
                weeks: {
                    include: { _count: { select: { workouts: true } } },
                    take: 1,
                    orderBy: { weekNumber: "asc" },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        plans = created.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            type: plan.type,
            shareCode: plan.shareCode,
            authorName: null as string | null,
            isOwned: true,
            isActive: false,
            weekCount: plan._count.weeks,
            startedAt: plan.createdAt.toISOString(),
            tags: plan.tags,
        }));
    } else {
        plans = user.plans.map((up) => {
            const isImported = up.plan.name.includes("(Imported)");
            const isSomeoneElsesPlan = up.plan.creatorId !== user.id;

            let authorName: string | null = null;
            if (isSomeoneElsesPlan) {
                authorName = up.plan.creator?.name ?? "Unknown";
            } else if (isImported) {
                authorName = "you";
            }

            return {
                id: up.plan.id,
                name: up.plan.name,
                description: up.plan.description,
                type: up.plan.type,
                shareCode: up.plan.shareCode,
                authorName,
                isOwned: !isSomeoneElsesPlan,
                isActive: up.isActive,
                weekCount: up.plan._count.weeks,
                startedAt: up.startedAt.toISOString(),
                tags: up.plan.tags,
            };
        });
    }

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
