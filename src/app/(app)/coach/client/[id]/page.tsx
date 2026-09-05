import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ClientDetailView } from "./ClientDetailView";
import { canonicalPeriodDueDateKey, getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { getPriorityActiveCheckInRequestForClient } from "@/lib/checkInRequests";
import { getClientAttentionActions, getEffectiveCheckInDueStateForUser, getExcusedMissedWorkoutKeys } from "@/lib/coachAttentionActions";
import { toDateKey } from "@/lib/utils";
import { getClientGoalTargets } from "@/lib/clientGoalTargets";
import { format } from "date-fns";
import { createExerciseSessionEntry, mergeSetIntoExerciseSession, normalizeExerciseHistory } from "@/lib/exerciseHistory";

import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";
import { dedupeCoachPlansByName } from "@/lib/coachPlans";
import { getUserPinnedExercises } from "@/lib/pinnedExercises";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { getNickname, pickDisplayName } from "@/lib/userNicknames";
import { activeWorkoutWhere } from "@/lib/planSchedule";
import { loadPlanScheduleRevisions } from "@/lib/planScheduleHistory";
import { computeWorkoutAdherence } from "@/lib/workoutAdherenceStreak";
import { loadHistoricalMissedSessions, persistPastDueScheduledSessionsForUser } from "@/lib/planMissedSessionHistory";
import { loadCoachClientProfileInsights } from "@/lib/coachClientProfileData";

export const metadata = { title: "Client Details" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId } = await auth();
        if (!userId) redirect("/sign-in");

        const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!actor || !["COACH", "SUPER_ADMIN"].includes(actor.role)) redirect("/dashboard");

        const target = await prisma.user.findUnique({
            where: { id },
            include: {
                workoutLogs: {
                    where: { status: "COMPLETED" },
                    include: { workout: { select: { name: true } }, sets: true },
                    orderBy: { loggedAt: "desc" },
                    take: 40,
                },
                checkIns: { orderBy: { createdAt: "desc" }, select: { createdAt: true } },
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
                                            include: { exercises: { select: { id: true } } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    take: 1,
                },
                coach: { select: { name: true, email: true } },
            },
        });

        if (!target) notFound();
        if (actor.role === "COACH" && target.coachId !== actor.id) {
            redirect("/coach");
        }
        const isInactiveClient =
            target.isDeleted ||
            target.isDeactivated ||
            target.email.endsWith("@deleted.local");

        const clientNickname = isInactiveClient ? null : await getNickname(actor.id, target.id);
        const clientDisplayName = isInactiveClient
            ? "Inactive account"
            : pickDisplayName(target.name, target.email, clientNickname, target.name || "Client");

        const checkInSchedule = await getUserCheckInSchedule(target.id);
        const checkInDueState = await getEffectiveCheckInDueStateForUser(target.id, checkInSchedule, new Date());

        const activeUserPlan = target.plans[0] ?? null;
        const [activePlan, availablePlans, bodyweightRows, completedLogs, clientMetricTargets, pinnedExercises, clientActions, historicalMissedSessions, activeCheckInRequest] = await Promise.all([
            Promise.resolve(target.plans[0]?.plan ?? null),
            prisma.plan.findMany({
                where: { creatorId: actor.id },
                select: { id: true, name: true, type: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
            }).then((plans) => dedupeCoachPlansByName(plans).map(({ updatedAt: _updatedAt, ...plan }) => plan)),
            prisma.$queryRaw<Array<{ date: string; weightKg: number }>>`
                SELECT "loggedDate"::text AS "date", "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${target.id}
                ORDER BY "loggedDate" ASC
            `,
            prisma.workoutLog.findMany({
                where: { userId: target.id, status: "COMPLETED" },
                include: {
                    workout: { select: { name: true } },
                    sets: {
                        include: {
                            exercise: { select: { name: true, muscleGroup: true } }
                        },
                        orderBy: { setNumber: "asc" }
                    }
                },
                orderBy: { loggedAt: "asc" }
            }),
            getClientGoalTargets(target.id),
            getUserPinnedExercises(target.id),
            getClientAttentionActions(target.id),
            persistPastDueScheduledSessionsForUser(target.id).then(() => loadHistoricalMissedSessions(target.id)),
            getPriorityActiveCheckInRequestForClient(target.id),
        ]);

        const exerciseHistory: Record<string, any[]> = {};
        const exerciseLastDone: Record<string, number> = {};

        (completedLogs ?? []).forEach(log => {
            const sessionDate = log.loggedAt
                ? format(log.loggedAt, "MMM dd · h:mm a")
                : "";
            const logTime = log.loggedAt ? log.loggedAt.getTime() : 0;
            
            (log.sets ?? []).forEach((set: any) => {
                if (!set.exercise || !set.isCompleted || set.isWarmup) return;
                const exName = resolveLogSetExerciseName(set);
                const sWeight = set.weightKg || 0;
                const sReps = set.reps || 0;
                const sVol = sWeight * sReps;
                
                exerciseLastDone[exName] = Math.max(exerciseLastDone[exName] || 0, logTime);
                
                if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
                const existingSession = exerciseHistory[exName].find((h: any) => h.sessionId === log.id);
                if (existingSession) {
                    mergeSetIntoExerciseSession(existingSession, sWeight, sReps, sVol);
                } else {
                    exerciseHistory[exName].push(createExerciseSessionEntry(log.id, sessionDate, sWeight, sReps, sVol));
                }
            });
        });

        const normalizedExerciseHistory = normalizeExerciseHistory(exerciseHistory);
        const scheduleRevisions = activePlan ? await loadPlanScheduleRevisions(activePlan.id) : [];
        const planLike = activeUserPlan && activePlan
            ? {
                startedAt: activeUserPlan.startedAt,
                plan: {
                    id: activePlan.id,
                    weeks: activePlan.weeks.map((week) => ({
                        weekNumber: week.weekNumber,
                        workouts: week.workouts.map((workout) => ({
                            id: workout.id,
                            name: workout.name,
                            dayNumber: workout.dayNumber,
                            dayOfWeek: workout.dayOfWeek,
                            exercises: workout.exercises,
                        })),
                    })),
                },
                scheduleRevisions,
            }
            : null;
        const excusedMissedWorkoutKeys = getExcusedMissedWorkoutKeys(clientActions);
        const adherence = computeWorkoutAdherence({
            activeUserPlan: planLike,
            completedLogs: (completedLogs ?? []).map((log) => ({
                workoutId: log.workoutId,
                dateKey: toDateKey(log.loggedAt),
            })),
            excusedMissedWorkoutKeys: [...excusedMissedWorkoutKeys],
            historicalMissedSessions,
        });

        const insights = await loadCoachClientProfileInsights({
            actor: { id: actor.id, role: actor.role },
            client: {
                id: target.id,
                coachId: target.coachId,
                createdAt: target.createdAt,
                isCoachPaused: Boolean(target.isCoachPaused),
                coachResumedAt: target.coachResumedAt,
                targetWeightKg: target.targetWeightKg,
                targetCalories: clientMetricTargets.targetCalories,
                targetSteps: clientMetricTargets.targetSteps,
                targetSleepHours: clientMetricTargets.targetSleepHours,
                checkInFrequencyWeeks: checkInSchedule.frequencyWeeks,
            },
            canEdit: !isInactiveClient,
            checkInDueState,
            currentStreak: adherence.currentStreak,
            historicalMissedSessions,
            activeUserPlan: planLike,
            planName: activePlan?.name ?? null,
            planId: activePlan?.id ?? null,
            excusedMissedWorkoutKeys,
            completedLogs: (completedLogs ?? []).map((log) => ({
                id: log.id,
                workoutId: log.workoutId,
                workoutName: log.workout.name,
                loggedAt: log.loggedAt,
                duration: log.duration,
                sets: (log.sets ?? []).map((set) => ({
                    isCompleted: set.isCompleted,
                    isWarmup: set.isWarmup,
                    isPR: set.isPR,
                    reps: set.reps,
                    weightKg: set.weightKg,
                    exerciseId: set.exerciseId,
                })),
            })),
            bodyweightHistory: bodyweightRows || [],
            checkInSubmittedAt: (target.checkIns ?? []).map((checkIn) => checkIn.createdAt.toISOString()),
        });

        return (
            <>
                <TopBar
                    title={isInactiveClient ? "Inactive account" : target.name || "Client Details"}
                    subtitle={isInactiveClient ? "This account is deleted or deactivated — view only." : target.email}
                    hideSearch={true}
                />
                <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                    <ClientDetailView
                        readOnly={isInactiveClient}
                        client={{
                            id: target.id,
                            name: clientDisplayName,
                            email: isInactiveClient ? "View only" : target.email,
                            role: target.role,
                            assignedCoachName: actor.role === "SUPER_ADMIN" ? target.coach?.name ?? target.coach?.email ?? null : null,
                            avatarUrl: target.avatarUrl,
                            activePlan: activePlan ? { id: activePlan.id, name: activePlan.name } : null,
                            experience: target.experienceLevel,
                            goal: target.goal,
                            trainingDaysPerWeek: target.trainingDaysPerWeek,
                            checkInSchedule,
                            targetWeightKg: target.targetWeightKg,
                            currentWeightKg: insights.periods["30d"].bodyweightCurrentKg ?? target.weightKg,
                            lastActiveAt: target.lastActiveAt?.toISOString() || null,
                            hiddenGoals: target.hiddenGoals ?? [],
                            targetCalories: clientMetricTargets.targetCalories,
                            targetSteps: clientMetricTargets.targetSteps,
                            targetSleepHours: clientMetricTargets.targetSleepHours,
                            isCoachPaused: Boolean(target.isCoachPaused),
                        }}
                        currentUserId={actor.id}
                        availablePlans={availablePlans}
                        bodyweightHistory={bodyweightRows || []}
                        workoutHistory={(completedLogs ?? []).map((log) => {
                            const workingSets = (log.sets ?? []).filter((set) => set.isCompleted && !set.isWarmup);
                            return {
                                id: log.id,
                                workoutId: log.workoutId,
                                workoutName: log.workout.name,
                                date: log.loggedAt ? log.loggedAt.toISOString() : new Date().toISOString(),
                                duration: log.duration || 0,
                                volume: (log.sets ?? []).reduce((sum, set) => sum + (set.reps || 0) * (set.weightKg || 0), 0),
                                setCount: workingSets.length,
                                prCount: workingSets.filter((set) => set.isPR).length,
                            };
                        })}
                        exerciseHistory={normalizedExerciseHistory}
                        exerciseLastDone={exerciseLastDone}
                        initialPinnedExercises={pinnedExercises}
                        insights={insights}
                        checkInRequest={{
                            weekNumber: checkInDueState.outstandingWeekNumber,
                            periodDueDateKey: canonicalPeriodDueDateKey(checkInDueState.currentPeriodDueDate),
                            isOverdue: Boolean(checkInDueState.isOverdue || checkInDueState.isDueToday),
                            alreadyRequested: Boolean(
                                activeCheckInRequest
                                && checkInDueState.outstandingWeekNumber != null
                                && activeCheckInRequest.weekNumber === checkInDueState.outstandingWeekNumber
                            ),
                        }}
                    />
                </div>
            </>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[ClientDetailPage] Error:", e);
        return <SafeFallback title="Client Details" errorDetails={formatErrorDetails(e)} />;
    }
}
