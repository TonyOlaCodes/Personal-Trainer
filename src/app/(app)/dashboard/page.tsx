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
                    include: { workout: true, sets: true },
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
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSession = await prisma.workoutLog.findFirst({
        where: { 
            userId: user.id, 
            status: "IN_PROGRESS",
            updatedAt: { gte: twentyFourHoursAgo }
        },
        include: { workout: true },
        orderBy: { updatedAt: "desc" }
    });

    // Current ISO week number
    const nowDate = new Date();
    const startOfYear = new Date(nowDate.getFullYear(), 0, 1);
    const pastDays = Math.floor((nowDate.getTime() - startOfYear.getTime()) / 86400000);
    const currentIsoWeek = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);

    const currentCheckin = await prisma.checkIn.findFirst({
        where: { userId: user.id, weekNumber: currentIsoWeek },
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
    // JS getDay(): 0=Sun, 1=Mon...6=Sat
    // Plan dayOfWeek: 0=Mon, 1=Tue...6=Sun  (set by the plan designer using 0-indexed Mon-start)
    // Convert JS getDay to Mon-based index:
    const jsDow = new Date().getDay();
    const todayDow0Mon = jsDow === 0 ? 6 : jsDow - 1; // 0=Mon ... 6=Sun

    let todayWorkout: any = null;
    if (currentWeek) {
        // Exact dayOfWeek match only (0=Mon...6=Sun)
        todayWorkout = currentWeek.workouts.find((w: any) => w.dayOfWeek === todayDow0Mon)
                    // Backwards-compat for old data stored with JS getDay() (0=Sun)
                    ?? currentWeek.workouts.find((w: any) => w.dayOfWeek === jsDow && jsDow !== 0)
                    ?? null;
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

    // Streak: consecutive days with a completed log (up to today)
    const allLogDates = [...new Set(
        user.workoutLogs
            .filter((l: any) => l.status === "COMPLETED")
            .map((l: any) => new Date(l.loggedAt).toDateString())
    )].map(d => new Date(d).getTime()).sort((a, b) => b - a);

    let streak = 0;
    let checkDay = new Date();
    checkDay.setHours(0, 0, 0, 0);
    for (const dayTime of allLogDates) {
        if (dayTime === checkDay.getTime()) {
            streak++;
            checkDay.setDate(checkDay.getDate() - 1);
        } else if (dayTime < checkDay.getTime()) {
            break;
        }
    }

    // Weekly volume in kg
    const weeklyVolumeKg = user.workoutLogs
        .filter((l: any) => l.status === "COMPLETED" && new Date(l.loggedAt) >= startOfWeek)
        .reduce((total: number, l: any) => {
            const vol = (l as any).sets?.filter((set: any) => set.isCompleted).reduce((s: number, set: any) =>
                s + ((set.reps || 0) * (set.weightKg || 0)), 0) || 0;
            return total + vol;
        }, 0);

    const weeklyMetrics = {
        workoutsCompleted: workoutsThisWeek,
        streak,
        weeklyVolumeKg: Math.round(weeklyVolumeKg),
    };

    return (
        <>
            <TopBar title={getDayName()} subtitle={formatDate(new Date())} streak={weeklyMetrics.streak} />
            <div className="p-6 max-w-5xl mx-auto">
                    <DashboardClient
                        user={{ name: user.name, role: user.role, weightKg: user.weightKg, targetWeightKg: user.targetWeightKg }}
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
                        currentCheckin={currentCheckin ? {
                            id: currentCheckin.id,
                            weekNumber: currentCheckin.weekNumber,
                            status: currentCheckin.status as string,
                        } : null}
                    />
            </div>
        </>
    );
}
