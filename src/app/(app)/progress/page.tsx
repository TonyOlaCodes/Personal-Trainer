import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ProgressClient } from "./ProgressClient";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";
import { parseLogDate, toDateKey } from "@/lib/utils";
import { serializePlanWeeksForSchedule, loadPlanScheduleRevisions } from "@/lib/planScheduleHistory";
import { resolvePlannedWorkoutWithExercisesForDate } from "@/lib/plannedWorkoutResolve";
import { activeWorkoutWhere } from "@/lib/planWorkouts";

export const metadata = {
    title: "Progress",
    description: "Track bodyweight, strength PRs, workout consistency, and training volume.",
};

export default async function ProgressPage() {
    try {
        const { userId } = await auth();
        if (!userId) redirect("/sign-in");

        let user = null;
        try {
            user = await prisma.user.findUnique({ 
                where: { clerkId: userId },
                select: {
                    role: true,
                    hiddenGoals: true,
                    plans: {
                        where: { isActive: true },
                        include: {
                            plan: {
                                include: {
                                    weeks: {
                                        orderBy: { weekNumber: "asc" },
                                        include: {
                                            workouts: {
                                                where: activeWorkoutWhere(),
                                                orderBy: { dayNumber: "asc" },
                                                include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        take: 1,
                    },
                }
            });
        } catch (dbErr) {
            console.warn("[ProgressPage] Failed to fetch user with hiddenGoals, retrying with role only:", dbErr);
            try {
                user = await prisma.user.findUnique({
                    where: { clerkId: userId },
                    select: { role: true, hiddenGoals: true }
                });
            } catch (dbErr2) {
                console.error("[ProgressPage] Failed to fetch user completely:", dbErr2);
            }
        }
        
        if (!user) redirect("/sign-in");

        if (user.role === "COACH" || user.role === "SUPER_ADMIN") {
            redirect("/coach");
        }

        const hiddenGoals = (user as any).hiddenGoals ?? [];
        const activeUserPlan = (user as any).plans?.[0] ?? null;
        const todayDate = toDateKey(new Date());
        const today = parseLogDate(todayDate);
        let todayWorkoutHref: string | null = null;

        if (activeUserPlan?.plan?.weeks?.length) {
            const serializedWeeks = serializePlanWeeksForSchedule(
                activeUserPlan.plan.weeks.map((week: any) => ({
                    weekNumber: week.weekNumber,
                    workouts: week.workouts.map((workout: any) => ({
                        id: workout.id,
                        name: workout.name,
                        dayNumber: workout.dayNumber,
                        dayOfWeek: workout.dayOfWeek ?? null,
                        exercises: workout.exercises.map((exercise: any) => ({
                            id: exercise.id,
                            name: exercise.name,
                            sets: exercise.sets,
                            reps: exercise.reps,
                        })),
                    })),
                }))
            );
            const scheduleRevisions = await loadPlanScheduleRevisions(activeUserPlan.plan.id);
            const todayWorkout = resolvePlannedWorkoutWithExercisesForDate({
                startedAt: activeUserPlan.startedAt,
                weeks: serializedWeeks,
                scheduleRevisions,
                date: today,
                today,
            });
            if (todayWorkout) {
                todayWorkoutHref = `/plans/log/${todayWorkout.id}?date=${encodeURIComponent(todayDate)}`;
            }
        }

        return (
            <div className="bg-surface-base min-h-screen">
                <TopBar 
                    title="Progress" 
                    subtitle="Am I improving?" 
                />
                <main className="animate-fade-in">
                    <ProgressClient userRole={user.role} hiddenGoals={hiddenGoals} todayWorkoutHref={todayWorkoutHref} />
                </main>
            </div>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[ProgressPage] Error:", e);
        return <SafeFallback title="Progress" errorDetails={formatErrorDetails(e)} />;
    }
}
