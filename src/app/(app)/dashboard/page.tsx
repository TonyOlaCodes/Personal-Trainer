import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { getDayName, getWeekNumber, isSameCalendarDay, parseLogDate, toDateKey } from "@/lib/utils";
import { startOfWeek, endOfWeek } from "date-fns";
import { getBodyweightWeeklyAverage } from "@/lib/bodyweight";
import { getWorkoutsTargetFromUserPlan } from "@/lib/planTrainingTarget";
import { withResolvedCheckInMedia } from "@/lib/uploadUrls";
import { DashboardClient } from "./DashboardClient";
import { getBodyweightSummary } from "@/lib/bodyweight";
import { getCheckInDueState, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getDailyMetricsSummary } from "@/lib/dailyMetrics";
import { ensureAppSchema, formatErrorDetails } from "@/lib/ensureAppSchema";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";
import { isCoachRole } from "@/lib/roles";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
    try {
        await ensureAppSchema();
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
                    workoutLogs: {
                        where: { status: "COMPLETED" },
                        orderBy: { loggedAt: "desc" },
                        take: 20,
                        include: { workout: true, sets: true },
                    },
                },
            });
        } catch (e) {
            console.error("[Dashboard] Failed to load dashboard user:", e);
            throw e;
        }

        if (!user) {
            redirect("/onboarding");
        }

        if (!user.onboardingDone) redirect("/onboarding");

        if (isCoachRole(user.role)) {
            redirect("/coach");
        }

        await cleanupStaleInProgressSessions(user.id);

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

        const todayDate = toDateKey(new Date());
        const today = parseLogDate(todayDate);

        const currentIsoWeek = getWeekNumber(today);

        const currentCheckin = await prisma.checkIn.findFirst({
            where: { userId: user.id, weekNumber: currentIsoWeek },
            orderBy: { createdAt: "desc" },
        });

        const activeUserPlan = user.plans[0] ?? null;
        const activePlan = activeUserPlan?.plan ?? null;
        const weeks = activePlan?.weeks ?? [];
        
        let currentWeekIndex = 0;
        let todayWorkout: any = null;
        const jsDow = today.getDay();
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

            const diffDays = Math.floor((today.getTime() - startedAt.getTime()) / 86400000);
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
                 isSameCalendarDay(l.loggedAt, todayDate)
        );

        let totalDuration = 0;
        let durationCount = 0;

        const recentCompletedLogs = user.workoutLogs
            .filter((l: any) => l.status === "COMPLETED" && l.workout && l.id !== activeSession?.id);

        recentCompletedLogs.forEach((l: any) => {
            if (l.duration) {
                totalDuration += l.duration;
                durationCount++;
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
        const checkDay = parseLogDate(todayDate);
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
            const candidateDate = parseLogDate(todayDate);
            candidateDate.setDate(candidateDate.getDate() + offset);
            const candidateWorkout = findWorkoutForDate(candidateDate);
            if (candidateWorkout) {
                nextTrainingDay = {
                    id: candidateWorkout.id,
                    name: candidateWorkout.name,
                    date: toDateKey(candidateDate),
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

        const checkInPanel = user.role !== "FREE"
            ? {
                checkIns: (await prisma.checkIn.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: "desc" },
                })).map((c) => withResolvedCheckInMedia({
                    id: c.id,
                    userId: c.userId,
                    createdAt: c.createdAt.toISOString(),
                    weekNumber: c.weekNumber,
                    bodyweightKg: c.bodyweightKg,
                    feedback: c.feedback,
                    notes: c.notes,
                    status: c.status,
                    coachResponse: c.coachResponse,
                    respondedAt: c.respondedAt?.toISOString() ?? null,
                    sleepRating: c.sleepRating,
                    dietRating: c.dietRating,
                    stressRating: c.stressRating,
                    energyRating: c.energyRating,
                    intensityRating: c.intensityRating,
                    frontImageUrl: c.frontImageUrl,
                    sideImageUrl: c.sideImageUrl,
                    videoUrl: c.videoUrl,
                    coachVideoUrl: c.coachVideoUrl,
                })),
                workoutsThisWeek: await prisma.workoutLog.count({
                    where: {
                        userId: user.id,
                        status: "COMPLETED",
                        loggedAt: {
                            gte: startOfWeek(today, { weekStartsOn: 1 }),
                            lte: endOfWeek(today, { weekStartsOn: 1 }),
                        },
                    },
                }),
                workoutsTarget: getWorkoutsTargetFromUserPlan(
                    user.trainingDaysPerWeek,
                    activeUserPlan ? { startedAt: activeUserPlan.startedAt, plan: activePlan } : null
                ),
                bodyweightWeeklyAverage: await getBodyweightWeeklyAverage(user.id, todayDate),
                checkInSchedule,
            }
            : null;

        return (
            <>
                <TopBar showToday streak={streak} hideSearch={true} />
                <div className="p-6 max-w-5xl mx-auto">
                        <DashboardClient
                            user={{ name: user.name, role: user.role, weightKg: user.weightKg, targetWeightKg: user.targetWeightKg, hiddenGoals: user.hiddenGoals ?? [] }}
                            activePlan={activePlan ? { name: activePlan.name } : null}
                            todayWorkout={todayWorkout}
                            nextTrainingDay={nextTrainingDay}
                            todayCompleted={!!isTodayWorkoutCompleted}
                            avgDurationMin={avgDurationMin}
                            activeSession={activeSession?.workout ? {
                                id: activeSession.id,
                                workoutId: activeSession.workoutId,
                                workoutName: activeSession.workout.name,
                                loggedAt: activeSession.loggedAt.toISOString(),
                            } : null}
                            recentLogs={recentCompletedLogs.map((l: any) => ({
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
                            checkInPanel={checkInPanel}
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
        rethrowNextInternalErrors(error);
        console.error("[DashboardPage] Error:", error);
        return <SafeFallback title="Dashboard" errorDetails={formatErrorDetails(error)} />;
    }
}
