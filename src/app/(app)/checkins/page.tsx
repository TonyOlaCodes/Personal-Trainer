import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CheckInsClient } from "./CheckInsClient";
import { startOfWeek, endOfWeek } from "date-fns";

export const metadata = { title: "Check-ins" };

export default async function CheckInsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            plans: {
                where: { isActive: true },
                include: {
                    plan: {
                        include: {
                            weeks: {
                                orderBy: { weekNumber: "asc" },
                                include: { workouts: true },
                            },
                        },
                    },
                },
                take: 1,
            },
            workoutLogs: {
                where: {
                    status: "COMPLETED",
                    loggedAt: {
                        gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
                        lte: endOfWeek(new Date(), { weekStartsOn: 1 }),
                    }
                },
                select: { id: true }
            }
        }
    });
    if (!user) redirect("/sign-in");

    // Calculate workouts target from active plan if available
    let workoutsTarget = user.trainingDaysPerWeek ?? 4;
    const activeUserPlan = user.plans[0];
    if (activeUserPlan) {
        const weeks = activeUserPlan.plan.weeks;
        const startedAt = new Date(activeUserPlan.startedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - startedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let currentWeekIndex = Math.floor(diffDays / 7);
        if (currentWeekIndex >= weeks.length) currentWeekIndex = weeks.length - 1;
        
        const currentWeekPlan = weeks[currentWeekIndex];
        if (currentWeekPlan) {
            workoutsTarget = currentWeekPlan.workouts.length;
        }
    }

    const isCoach = ["COACH", "SUPER_ADMIN"].includes(user.role);

    const checkIns = isCoach
        ? await prisma.checkIn.findMany({
            where: { user: { coachId: user.id } },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" },
        })
        : await prisma.checkIn.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });

    const workoutsThisWeek = user.workoutLogs?.length ?? 0;

    return (
        <>
            <TopBar
                title={isCoach ? "Check-ins" : "Weekly Check-in"}
                subtitle={isCoach ? "Client submissions" : "Log your weekly progress"}
            />
            <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-20">
                <CheckInsClient
                    checkIns={checkIns.map((c: any) => ({
                        id: c.id,
                        createdAt: c.createdAt.toISOString(),
                        weekNumber: c.weekNumber,
                        bodyweightKg: c.bodyweightKg,
                        feedback: c.feedback,
                        notes: c.notes,
                        status: c.status,
                        coachResponse: c.coachResponse,
                        respondedAt: c.respondedAt?.toISOString() || null,
                        sleepRating: c.sleepRating,
                        stressRating: c.stressRating,
                        energyRating: c.energyRating,
                        intensityRating: c.intensityRating,
                        frontImageUrl: c.frontImageUrl,
                        sideImageUrl: c.sideImageUrl,
                        user: c.user ? { name: c.user.name, email: c.user.email } : undefined,
                    }))}
                    isCoach={isCoach}
                    userRole={user.role}
                    workoutsThisWeek={workoutsThisWeek}
                    workoutsTarget={workoutsTarget}
                />
            </div>
        </>
    );
}
