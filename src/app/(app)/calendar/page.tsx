import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CalendarClient } from "./CalendarClient";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
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
                                include: { workouts: { include: { exercises: { orderBy: { order: "asc" } } }, orderBy: { dayNumber: "asc" } } },
                                orderBy: { weekNumber: "asc" },
                            },
                        },
                    },
                },
                take: 1,
            },
            workoutLogs: {
                include: { 
                    workout: { select: { name: true } },
                    sets: { include: { exercise: { select: { name: true } } } }
                },
                orderBy: { loggedAt: "desc" },
                take: 90,
            },
        },
    });

    if (!user) redirect("/sign-in");

    const activePlan = user.plans[0]?.plan ?? null;
    const logs = user.workoutLogs;

    return (
        <>
            <TopBar title="Calendar" subtitle="Your training schedule" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
                <CalendarClient
                    activePlan={activePlan ? {
                        name: activePlan.name,
                        weeks: activePlan.weeks.map((w) => ({
                            weekNumber: w.weekNumber,
                            workouts: w.workouts.map((wd) => ({
                                dayNumber: wd.dayNumber,
                                dayOfWeek: (wd as any).dayOfWeek,
                                name: wd.name,
                                id: wd.id,
                                exercises: wd.exercises.map(ex => ({
                                    name: ex.name,
                                    sets: ex.sets,
                                    reps: ex.reps
                                }))
                            })),
                        })),
                    } : null}
                    loggedDates={logs.map((l) => ({
                        date: l.loggedAt.toISOString(),
                        workoutName: l.workout.name,
                        exercises: Array.from(new Set((l as any).sets.map((s: any) => s.exercise.name))) as string[]
                    }))}
                />
            </div>
        </>
    );
}
