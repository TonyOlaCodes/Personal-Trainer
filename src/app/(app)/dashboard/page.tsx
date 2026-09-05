import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { getDayName, getWeekNumber, isSameCalendarDay, parseLogDate, toDateKey } from "@/lib/utils";
import { startOfWeek, endOfWeek } from "date-fns";
import { getBodyweightHistory, getBodyweightSummary } from "@/lib/bodyweight";
import { getBodyweightAverageSinceLastCheckIn } from "@/lib/checkInPeriodSummary";
import { getWorkoutsTargetFromUserPlan, isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import { getPlannedWorkoutForDate } from "@/lib/planSchedule";
import { loadPlanScheduleRevisions, serializePlanWeeksForSchedule } from "@/lib/planScheduleHistory";
import { resolvePlannedWorkoutWithExercisesForDate, sortPlannedExercises } from "@/lib/plannedWorkoutResolve";
import { withResolvedCheckInMedia } from "@/lib/uploadUrls";
import { DashboardClient } from "./DashboardClient";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getEffectiveCheckInDueStateForUser } from "@/lib/coachAttentionActions";
import { ensureAppSchema, formatErrorDetails } from "@/lib/ensureAppSchema";
import { activeWorkoutWhere } from "@/lib/planWorkouts";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { cleanupStaleInProgressSessions } from "@/lib/workoutSessionCleanup";
import { isCoachRole, canAccessCheckIns } from "@/lib/roles";
import { getWorkoutStreak } from "@/lib/workoutAdherenceStreak";
import { getClientGoalTargets } from "@/lib/clientGoalTargets";
import { getDailyMetricsSummary } from "@/lib/dailyMetrics";

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
        const checkInSchedule = await getUserCheckInSchedule(user.id);
        const checkInDueState = await getEffectiveCheckInDueStateForUser(
            user.id,
            checkInSchedule,
            today
        );
        const coveringWeek = checkInDueState.outstandingWeekNumber ?? currentIsoWeek;

        const currentCheckin = await prisma.checkIn.findFirst({
            where: { userId: user.id, weekNumber: coveringWeek },
            orderBy: { createdAt: "desc" },
        });
        const activeUserPlan = user.plans[0] ?? null;
        const activePlan = activeUserPlan?.plan ?? null;
        const activeUserPlanLike = activeUserPlan && activePlan
            ? { startedAt: activeUserPlan.startedAt, plan: { weeks: activePlan.weeks } }
            : null;

        const todayWorkoutPlannedRaw = getPlannedWorkoutForDate(activeUserPlanLike, today, { today });
        const todayWorkoutPlanned = isScheduledTrainingWorkout(todayWorkoutPlannedRaw)
            ? todayWorkoutPlannedRaw
            : null;

        const [scheduleRevisions] = await Promise.all([
            activePlan ? loadPlanScheduleRevisions(activePlan.id) : Promise.resolve([]),
        ]);

        const serializedWeeks = activePlan
            ? serializePlanWeeksForSchedule(
                activePlan.weeks.map((week) => ({
                    weekNumber: week.weekNumber,
                    workouts: week.workouts.map((workout) => ({
                        id: workout.id,
                        name: workout.name,
                        dayNumber: workout.dayNumber,
                        dayOfWeek: (workout as { dayOfWeek?: number | null }).dayOfWeek ?? null,
                        exercises: workout.exercises.map((exercise) => ({
                            id: exercise.id,
                            name: exercise.name,
                            sets: exercise.sets,
                            reps: exercise.reps,
                        })),
                    })),
                }))
            )
            : [];

        const todayWorkoutResolvedRaw = activeUserPlan && serializedWeeks.length > 0
            ? resolvePlannedWorkoutWithExercisesForDate({
                startedAt: activeUserPlan.startedAt,
                weeks: serializedWeeks,
                scheduleRevisions,
                date: today,
                today,
            })
            : null;
        const todayWorkoutResolved = isScheduledTrainingWorkout(todayWorkoutResolvedRaw)
            ? todayWorkoutResolvedRaw
            : null;

        const todayWorkoutFromPlan = todayWorkoutPlanned && activePlan
            ? activePlan.weeks.flatMap((week) => week.workouts).find((w) => w.id === todayWorkoutPlanned.id) ?? null
            : null;

        const todayWorkout = todayWorkoutResolved
            ? {
                id: todayWorkoutResolved.id,
                name: todayWorkoutResolved.name,
                notes: (todayWorkoutFromPlan as { notes?: string | null } | null)?.notes ?? null,
                exercises: sortPlannedExercises(todayWorkoutResolved.exercises).map((ex) => {
                    const full = todayWorkoutFromPlan?.exercises.find((row) => row.id === ex.id);
                    return {
                        id: ex.id,
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        order: ex.order,
                        weightTargetKg: full?.weightTargetKg ?? null,
                        muscleGroup: full?.muscleGroup ?? null,
                    };
                }),
            }
            : null;

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
            if (l.duration != null) {
                totalDuration += l.duration;
                durationCount++;
            }
        });

        const avgDurationMin = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

        const streak = await getWorkoutStreak(user.id);

        let nextTrainingDay: { id: string; name: string; date: string; dayLabel: string } | null = null;
        for (let offset = 1; offset <= 42; offset++) {
            const candidateDate = parseLogDate(todayDate);
            candidateDate.setDate(candidateDate.getDate() + offset);
            const candidateWorkout = getPlannedWorkoutForDate(activeUserPlanLike, candidateDate, { today });
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

        const [bodyweight, bodyweightHistory, goalTargets, dailyLifestyle] = await Promise.all([
            getBodyweightSummary(user.id, todayDate),
            getBodyweightHistory(user.id, 14),
            getClientGoalTargets(user.id),
            getDailyMetricsSummary(user.id, todayDate),
        ]);

        const checkInPanel = canAccessCheckIns(user.role, user.coachId)
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
                bodyweightSinceLastCheckIn: await getBodyweightAverageSinceLastCheckIn(
                    user.id,
                    todayDate,
                    user.createdAt
                ),
                checkInSchedule,
            }
            : null;

        return (
            <>
                <TopBar showToday streak={streak} hideSearch={true} />
                <div className="p-6 max-w-5xl mx-auto">
                        <DashboardClient
                            user={{ name: user.name, role: user.role, weightKg: user.weightKg, targetWeightKg: goalTargets.targetWeightKg, goal: goalTargets.goal, hiddenGoals: user.hiddenGoals ?? [] }}
                            activePlan={activePlan ? { id: activePlan.id, name: activePlan.name } : null}
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
                                createdAt: currentCheckin.createdAt.toISOString(),
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
                                history: bodyweightHistory,
                            }}
                            dailyLifestyle={{
                                calories: dailyLifestyle.selected?.calories ?? null,
                                steps: dailyLifestyle.selected?.steps ?? null,
                                sleepHours: dailyLifestyle.selected?.sleepHours ?? null,
                                targets: dailyLifestyle.targets,
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
