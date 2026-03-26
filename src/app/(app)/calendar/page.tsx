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
                                include: { 
                                    workouts: { 
                                        include: { exercises: { orderBy: { order: "asc" } } }, 
                                        orderBy: { dayNumber: "asc" } 
                                    } 
                                },
                                orderBy: { weekNumber: "asc" },
                            },
                        },
                    },
                },
                take: 1,
            },
            workoutLogs: {
                include: { 
                    workout: { 
                        select: { name: true, id: true } 
                    },
                    sets: { 
                        include: { 
                            exercise: { select: { name: true } } 
                        } 
                    }
                },
                orderBy: { loggedAt: "desc" },
                take: 120, // Increased for better monthly snapshots
            },
        },
    });

    if (!user) redirect("/sign-in");

    const userPlan = user.plans[0] ?? null;
    const activePlan = userPlan?.plan ?? null;
    const logs = user.workoutLogs;

    return (
        <>
            <TopBar title="Calendar" subtitle="Your training schedule" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto pb-20">
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
                    planStartedAt={userPlan?.startedAt ? userPlan.startedAt.toISOString() : null}
                    loggedDates={logs.map((l) => ({
                        id: l.id,
                        date: l.loggedAt.toISOString(),
                        workoutName: l.workout.name,
                        workoutId: (l as any).workoutId || l.workout?.id,
                        duration: (l as any).duration || null,
                        sets: l.sets.map(s => ({
                            exerciseName: s.exercise.name,
                            setNumber: s.setNumber,
                            reps: s.reps,
                            weightKg: s.weightKg,
                            rpe: (s as any).rpe
                        }))
                    }))}
                />
            </div>
        </>
    );
}
