import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ClientDetailView } from "./ClientDetailView";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";

export const metadata = { title: "Client Details" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || !["COACH", "SUPER_ADMIN"].includes(actor.role)) redirect("/dashboard");

    const target = await prisma.user.findUnique({
        where: { id },
        include: {
            workoutLogs: {
                include: { workout: { select: { name: true } }, sets: true },
                orderBy: { loggedAt: "desc" },
                take: 10,
            },
            checkIns: { orderBy: { createdAt: "desc" }, take: 5 },
            plans: { where: { isActive: true }, include: { plan: true }, take: 1 },
            coach: { select: { name: true, email: true } },
        },
    });

    if (!target) notFound();
    if (actor.role === "COACH" && target.coachId !== actor.id) {
        // Optional: check if the coach owns this client
        // redirect("/coach");
    }
    const isDeletedClient = target.email.endsWith("@deleted.local");

    const [activePlan, availablePlans, checkInSchedule] = await Promise.all([
        Promise.resolve(target.plans[0]?.plan ?? null),
        prisma.plan.findMany({
            where: {
                OR: [
                    { type: "PREBUILT" },
                    { creatorId: actor.id },
                ],
            },
            select: { id: true, name: true, type: true },
        }),
        getUserCheckInSchedule(target.id),
    ]);

    return (
        <>
            <TopBar
                title={isDeletedClient ? "Deleted account" : target.name || "Client Details"}
                subtitle={isDeletedClient ? "This client account is inactive and its data has been removed." : target.email}
            />
            <div className="p-6 max-w-5xl mx-auto">
                <ClientDetailView
                    client={{
                        id: target.id,
                        name: isDeletedClient ? "Deleted account" : target.name,
                        email: isDeletedClient ? "Inactive account" : target.email,
                        role: target.role,
                        assignedCoachName: actor.role === "SUPER_ADMIN" ? target.coach?.name ?? target.coach?.email ?? null : null,
                        avatarUrl: target.avatarUrl,
                        activePlan: activePlan ? { id: activePlan.id, name: activePlan.name } : null,
                        experience: target.experienceLevel,
                        goal: target.goal,
                        trainingLocation: target.trainingLocation,
                        trainingDaysPerWeek: target.trainingDaysPerWeek,
                        checkInSchedule,
                    }}
                    availablePlans={availablePlans}
                    logs={(() => {
                        const seenNames = new Set();
                        return target.workoutLogs
                            .filter(l => {
                                if (seenNames.has(l.workout.name)) return false;
                                seenNames.add(l.workout.name);
                                return true;
                            })
                            .map((l) => ({
                                id: l.id,
                                workoutName: l.workout.name,
                                date: l.loggedAt.toISOString(),
                                setCount: l.sets.length,
                            }));
                    })()}
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
