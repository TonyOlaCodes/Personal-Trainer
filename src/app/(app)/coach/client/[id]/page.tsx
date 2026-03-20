import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ClientDetailView } from "./ClientDetailView";

export const metadata = { title: "Client Details" };

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || !["COACH", "SUPER_ADMIN"].includes(actor.role)) redirect("/dashboard");

    const target = await prisma.user.findUnique({
        where: { id: params.id },
        include: {
            workoutLogs: {
                include: { workout: { select: { name: true } }, sets: true },
                orderBy: { loggedAt: "desc" },
                take: 10,
            },
            checkIns: { orderBy: { createdAt: "desc" }, take: 5 },
            plans: { where: { isActive: true }, include: { plan: true }, take: 1 },
        },
    });

    if (!target) notFound();
    if (actor.role === "COACH" && target.coachId !== actor.id) {
        // Optional: check if the coach owns this client
        // redirect("/coach");
    }

    const [activePlan, availablePlans] = await Promise.all([
        Promise.resolve(target.plans[0]?.plan ?? null),
        prisma.plan.findMany({
            where: {
                OR: [
                    { type: "SYSTEM" as any },
                    { creatorId: actor.id },
                ],
            },
            select: { id: true, name: true, type: true },
        }),
    ]);

    return (
        <>
            <TopBar title={target.name || "Client Details"} subtitle={target.email} />
            <div className="p-6 max-w-5xl mx-auto">
                <ClientDetailView
                    client={{
                        id: target.id,
                        name: target.name,
                        email: target.email,
                        role: target.role,
                        avatarUrl: target.avatarUrl,
                        activePlan: activePlan ? { id: activePlan.id, name: activePlan.name } : null,
                        experience: (target as any).experience,
                        goal: (target as any).goal,
                    }}
                    availablePlans={availablePlans}
                    logs={target.workoutLogs.map((l) => ({
                        id: l.id,
                        workoutName: l.workout.name,
                        date: l.loggedAt.toISOString(),
                        setCount: l.sets.length,
                    }))}
                    checkIns={target.checkIns.map((ci) => ({
                        id: ci.id,
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                        status: ci.coachResponse ? "Responded" : "Pending",
                    }))}
                />
            </div>
        </>
    );
}
