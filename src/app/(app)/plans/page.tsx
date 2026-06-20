import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PlansClient } from "./PlansClient";

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

    const plans = user.plans.map((up) => {
        const isImported = up.plan.name.includes("(Imported)");
        const isSomeoneElsesPlan = up.plan.creatorId !== user.id;

        let authorName: string | null = null;
        if (isSomeoneElsesPlan) {
            // Imported from another user
            authorName = up.plan.creator?.name ?? "Unknown";
        } else if (isImported) {
            // User imported their own plan via share code
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

    return (
        <>
            <TopBar title="Plans" subtitle="Manage your workout programmes" />
            <div className="p-6 max-w-5xl mx-auto">
                <Suspense fallback={<div className="min-h-[200px] animate-pulse rounded-xl bg-surface-muted" />}>
                    <PlansClient plans={plans} userRole={user.role} />
                </Suspense>
            </div>
        </>
    );
}
