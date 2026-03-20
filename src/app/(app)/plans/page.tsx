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

    const plans = user.plans.map((up) => ({
        id: up.plan.id,
        name: up.plan.name,
        description: up.plan.description,
        type: up.plan.type,
        isActive: up.isActive,
        weekCount: up.plan._count.weeks,
        startedAt: up.startedAt.toISOString(),
        tags: up.plan.tags,
    }));

    return (
        <>
            <TopBar title="Plans" subtitle="Manage your workout programmes" />
            <div className="p-6 max-w-5xl mx-auto">
                <PlansClient plans={plans} userRole={user.role} />
            </div>
        </>
    );
}
