import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { getDayName, formatDate, getWeekNumber } from "@/lib/utils";
import { cookies } from "next/headers";
import { DashboardClient } from "./DashboardClient";
import { getBodyweightSummary } from "@/lib/bodyweight";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getDailyMetricsSummary } from "@/lib/dailyMetrics";

import { SafeFallback, isNextInternalError } from "@/components/shared/SafeFallback";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
    try {
        await ensureDbSchema();
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
                                                include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
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

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const todayDate = `${year}-${month}-${day}`;

        now.setHours(0, 0, 0, 0);

        const currentIsoWeek = getWeekNumber(now);

        const currentCheckin = await prisma.checkIn.findFirst({
            where: { userId: user.id, weekNumber: currentIsoWeek },
            orderBy: { createdAt: "desc" },
        });

        const activeUserPlan = user.plans[0] ?? null;
        const activePlan = activeUserPlan?.plan ?? null;
        const weeks = activePlan?.weeks ?? [];
        
        let currentWeekIndex = 0;
        let todayWorkout: any = null;
        const jsDow = now.getDay();
        const todayDow0Mon = jsDow === 0 ? 6 : jsDow - 1; // 0=Mon ... 6=Sun

        const findWorkoutForDate = (date: Date) => {
            if (!activeUserPlan || weeks.length === 0) return null;

            const startedAt = new Date(activeUserPlan.startedAt);
            startedAt.setHours(0, 0, 0, 0);
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((targetDate.getTime() - startedAt.getTime()) / 86400000);
            if (diffDays < 0) return null;

            let weekIndex = Math.floor(diffDays / 7);
            if (weekIndex >= weeks.length) weekIndex = weekIndex % weeks.length;

            const week = weeks[weekIndex] || weeks[0];
            if (!week) return null;

            const targetJsDow = targetDate.getDay();
            const targetDow0Mon = targetJsDow === 0 ? 6 : targetJsDow - 1;
            const fallbackDayNumber = targetDow0Mon + 1;
            const usesOneIndexedWeekdays = week.workouts.length >= 5
                && week.workouts.every((w: any) => w.dayOfWeek !== null && w.dayOfWeek !== undefined && w.dayOfWeek === w.dayNumber);
            const targetDayOfWeek = usesOneIndexedWeekdays
                ? (targetDow0Mon === 6 ? 0 : targetDow0Mon + 1)
                : targetDow0Mon;

            return week.workouts.find((w: any) => w.dayOfWeek === targetDayOfWeek)
                || week.workouts.find((w: any) => (w.dayOfWeek === null || w.dayOfWeek === undefined) && w.dayNumber === fallbackDayNumber)
                || null;
        };

        if (activeUserPlan && weeks.length > 0) {
            const startedAt = new Date(activeUserPlan.startedAt);
            startedAt.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((now.getTime() - startedAt.getTime()) / 86400000);
            if (diffDays >= 0) {
                currentWeekIndex = Math.floor(diffDays / 7);
                if (currentWeekIndex >= weeks.length) currentWeekIndex = currentWeekIndex % weeks.length;

                const fallbackDayNumber = todayDow0Mon + 1;
                
                const week = weeks[currentWeekIndex] || weeks[0];
                if (week) {
                    const usesOneIndexedWeekdays = week.workouts.length >= 5
                        && week.workouts.every((w: any) => w.dayOfWeek !== null && w.dayOfWeek !== undefined && w.dayOfWeek === w.dayNumber);
                    const targetDayOfWeek = usesOneIndexedWeekdays
                        ? (todayDow0Mon === 6 ? 0 : todayDow0Mon + 1)
                        : todayDow0Mon;

                    todayWorkout = week.workouts.find((w: any) => w.dayOfWeek === targetDayOfWeek)
                                || week.workouts.find((w: any) => (w.dayOfWeek === null || w.dayOfWeek === undefined) && w.dayNumber === fallbackDayNumber)
                                || null;
                }
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
        
        user.workoutLogs
            .filter((l: any) => l.status === "COMPLETED")
            .forEach((l: any) => {
                if (l.duration) {
                    totalDuration += l.duration;
                    durationCount++;
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
        const checkDay = new Date();
        checkDay.setHours(0, 0, 0, 0);
        for (const dayTime of allLogDates) {
            if (dayTime === checkDay.getTime()) {
                streak++;
                checkDay.setDate(checkDay.getDate() - 1);
            } else if (dayTime < checkDay.getTime()) {
                break;
            }
        }

        let nextTrainingDay: { id: string; name: string; date: string; dayLabel: string } | null = null;
        for (let offset = 1; offset <= 42; offset++) {
            const candidateDate = new Date(now);
            candidateDate.setDate(now.getDate() + offset);
            const candidateWorkout = findWorkoutForDate(candidateDate);
            if (candidateWorkout) {
                nextTrainingDay = {
                    id: candidateWorkout.id,
                    name: candidateWorkout.name,
                    date: candidateDate.toISOString(),
                    dayLabel: getDayName(candidateDate),
                };
                break;
            }
        }

        const [bodyweight, dailyMetrics] = await Promise.all([
            getBodyweightSummary(user.id, todayDate),
            getDailyMetricsSummary(user.id, todayDate),
        ]);
        const checkInSchedule = await getUserCheckInSchedule(user.id);
        const checkInDueState = getCheckInDueState(checkInSchedule, new Date());

        return (
            <>
                <TopBar title={getDayName()} subtitle={formatDate(new Date())} streak={streak} hideSearch={true} />
                <div className="p-6 max-w-5xl mx-auto">
                        <DashboardClient
                            user={{ name: user.name, role: user.role, weightKg: user.weightKg, targetWeightKg: user.targetWeightKg, hiddenGoals: user.hiddenGoals ?? [] }}
                            activePlan={activePlan ? { name: activePlan.name } : null}
                            todayWorkout={todayWorkout}
                            nextTrainingDay={nextTrainingDay}
                            todayCompleted={!!isTodayWorkoutCompleted}
                            avgDurationMin={avgDurationMin}
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
                            checkInDueState={checkInDueState}
                            bodyweight={{
                                selectedDate: todayDate,
                                selectedWeightKg: bodyweight?.selected?.weightKg ?? null,
                                selectedPreviousWeightKg: bodyweight?.selectedPrevious?.weightKg ?? null,
                                latestWeightKg: bodyweight?.latest?.weightKg ?? user.weightKg ?? null,
                                latestPreviousWeightKg: bodyweight?.latestPrevious?.weightKg ?? null,
                                latestDate: bodyweight?.latest?.date ?? null,
                            }}
                            dailyMetrics={{
                                selectedDate: todayDate,
                                calories: dailyMetrics?.selected?.calories ?? null,
                                steps: dailyMetrics?.selected?.steps ?? null,
                                sleepHours: dailyMetrics?.selected?.sleepHours ?? null,
                                latestCalories: dailyMetrics?.latest?.calories ?? null,
                                latestSteps: dailyMetrics?.latest?.steps ?? null,
                                latestSleepHours: dailyMetrics?.latest?.sleepHours ?? null,
                                targets: dailyMetrics?.targets ?? { targetCalories: null, targetSteps: null, targetSleepHours: null },
                            }}
                        />
                </div>
            </>
        );
    } catch (error) {
        if (isNextInternalError(error)) throw error;
        console.error("[DashboardPage] Error:", error);
        return <SafeFallback title="Dashboard" />;
    }
}
