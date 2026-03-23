import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { getDayName, formatDate } from "@/lib/utils";
import { cookies } from "next/headers";
import { DashboardClient } from "./DashboardClient";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    let user = null;

    try {
        user = await prisma.user.findUnique({
            where: { clerkId: userId },
            include: {
                plans: {
                    where: { isActive: true },
                    include: {
                        plan: {
                            include: {
                                weeks: {
                                    orderBy: { weekNumber: "asc" },
                                    include: {
                                        workouts: {
                                            orderBy: { dayNumber: "asc" },
                                            include: { exercises: { orderBy: { order: "asc" } } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    take: 1,
                },
                workoutLogs: {
                    orderBy: { loggedAt: "desc" },
                    take: 20,
                    include: { workout: true },
                },
            },
        });
    } catch (e) {
        console.warn("[Dashboard] DB unreachable:", e);
    }

    if (!user) {
        redirect("/onboarding");
    }

    if (!user.onboardingDone) redirect("/onboarding");

    const cookieStore = await cookies();
    const viewMode = cookieStore.get("viewMode")?.value || "COACH";

    if ((user.role === "COACH" || user.role === "SUPER_ADMIN") && viewMode === "COACH") {
        redirect("/coach");
    }

    // Fetch active session separately to be safe or use the user object
    const activeSession = await prisma.workoutLog.findFirst({
        where: { userId: user.id, status: "IN_PROGRESS" },
        include: { workout: true },
        orderBy: { updatedAt: "desc" }
    });

    const activeUserPlan = user.plans[0] ?? null;
    const activePlan = activeUserPlan?.plan ?? null;
    const weeks = activePlan?.weeks ?? [];
    
    let currentWeekIndex = 0;
    if (activeUserPlan) {
        const startedAt = new Date(activeUserPlan.startedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - startedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        currentWeekIndex = Math.floor(diffDays / 7);
        // Fallback to the last available week if the client progresses past the defined weeks
        if (currentWeekIndex >= weeks.length) {
            currentWeekIndex = weeks.length - 1;
        }
    }
    const currentWeek = weeks[currentWeekIndex] ?? weeks[0] ?? null;
    const todayDayOfWeek = new Date().getDay();

    let todayWorkout = null;
    if (currentWeek) {
        // 1. Try to find a workout specifically assigned to this day of the week
        todayWorkout = currentWeek.workouts.find((w: any) => w.dayOfWeek === todayDayOfWeek);
        
        // 2. Fallback to dayNumber if no dayOfWeek matches (backward compatibility)
        if (!todayWorkout) {
            const adjustedIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
            todayWorkout = currentWeek.workouts[adjustedIndex] ?? currentWeek.workouts[0] ?? null;
        }
    }

    const isTodayWorkoutCompleted = todayWorkout && user.workoutLogs.some(
        (l: any) => l.status === "COMPLETED" && 
             l.workoutId === todayWorkout.id && 
             new Date(l.loggedAt).toDateString() === new Date().toDateString()
    );

    const uniqueLogs: any[] = [];
    const seenNames = new Set<string>();
    
    let totalDuration = 0;
    let durationCount = 0;
    
    let workoutsThisWeek = 0;
    let minsThisWeek = 0;
    
    // Get start of the current week (Sunday)
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    user.workoutLogs
        .filter((l: any) => l.status === "COMPLETED")
        .forEach((l: any) => {
            if (l.duration) {
                totalDuration += l.duration;
                durationCount++;
            }
            
            // Check if within this week
            const logDate = new Date(l.loggedAt);
            if (logDate >= startOfWeek) {
                workoutsThisWeek++;
                if (l.duration) minsThisWeek += l.duration;
            }

            if (!seenNames.has(l.workout.name) && activeSession?.id !== l.id) {
                seenNames.add(l.workout.name);
                uniqueLogs.push(l);
            }
        });

    const avgDurationMin = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    
    const weeklyMetrics = {
        workoutsCompleted: workoutsThisWeek,
        totalMins: minsThisWeek
    };

    return (
        <>
            <TopBar title={getDayName()} subtitle={formatDate(new Date())} />
            <div className="p-6 max-w-5xl mx-auto">
                    <DashboardClient
                        user={{ name: user.name, role: user.role }}
                        activePlan={activePlan ? { name: activePlan.name } : null}
                        todayWorkout={todayWorkout}
                        todayCompleted={!!isTodayWorkoutCompleted}
                        avgDurationMin={avgDurationMin}
                        weeklyMetrics={weeklyMetrics}
                        activeSession={activeSession ? {
                            id: activeSession.id,
                            workoutId: activeSession.workoutId,
                            workoutName: activeSession.workout.name,
                        } : null}
                        recentLogs={uniqueLogs
                            .slice(0, 5)
                            .map((l: any) => ({
                                id: l.id,
                                workoutId: l.workoutId,
                                workoutName: l.workout.name,
                                loggedAt: l.loggedAt.toISOString(),
                            }))
                        }
                    />
            </div>
        </>
    );
}
