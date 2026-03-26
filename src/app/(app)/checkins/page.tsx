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
        select: {
            id: true, role: true, trainingDaysPerWeek: true,
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
    const workoutsTarget = user.trainingDaysPerWeek ?? 4;

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
