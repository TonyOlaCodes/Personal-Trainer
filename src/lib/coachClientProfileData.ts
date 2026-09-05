import { APP_TIMEZONE, shiftAppDateKey } from "@/lib/appTimezone";
import { formatCheckInPeriodTitle } from "@/lib/checkInLabels";
import type { CheckInDueState } from "@/lib/checkInSchedule";
import { buildCoachClientAttentionItems, type CoachAttentionItem } from "@/lib/coachClientAttention";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { listCoachClientNotes, type CoachClientNote } from "@/lib/coachClientNotes";
import {
    COACH_PROFILE_PERIODS,
    clampPeriodStart,
    computePeriodBodyweightStats,
    computePeriodCheckInStats,
    computePeriodTrainingStats,
    eachDateKeyInclusive,
    expectedDaysInWindow,
    periodWindow,
    previousPeriodWindow,
    type CoachProfilePeriodKey,
} from "@/lib/coachClientPeriodStats";
import { getDailyMetricsInRange } from "@/lib/dailyMetrics";
import {
    interpretWeightChange,
    numericDelta,
    percentDelta,
    resolveWeightDirection,
    summarizeLifestylePeriod,
    type LifestylePeriodSummaries,
    type WeightDirection,
} from "@/lib/lifestylePeriodMetrics";
import {
    getPlanDayOffset,
    getPlanProgramWeekNumber,
    getPlannedWorkoutForDate,
    isDateAfterPlanEnd,
    type ActiveUserPlanLike,
} from "@/lib/planSchedule";
import {
    countPlannedTrainingSessions,
    getCurrentPlanWeekIndex,
    isScheduledTrainingWorkout,
} from "@/lib/planTrainingTarget";
import { canViewProgressPhotos } from "@/lib/profilePrivacy";
import { prisma } from "@/lib/prisma";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { parseLogDate, toDateKey } from "@/lib/utils";
import type { CompletedWorkoutLog } from "@/lib/workoutAdherenceStreak";

export type { CoachAttentionItem, CoachClientNote, CoachProfilePeriodKey, WeightDirection };

export interface CoachProfileMetricDelta {
    value: number | null;
    vsPrevious: number | null;
    vsPreviousPercent: number | null;
}

export interface CoachProfilePeriodSnapshot {
    key: CoachProfilePeriodKey;
    label: string;
    previousLabel: string;
    startDateKey: string;
    endDateKey: string;
    trainingAdherencePercent: number | null;
    workoutsCompleted: number;
    workoutsScheduled: number;
    missedWorkouts: number;
    avgDurationMin: number | null;
    volumeKg: number | null;
    prCount: number | null;
    lastTrainedAt: string | null;
    bodyweightCurrentKg: number | null;
    bodyweightAverageKg: number | null;
    bodyweightChangeKg: number | null;
    checkInSubmitted: number;
    checkInExpected: number | null;
    checkInCompletionPercent: number | null;
    lifestyle: LifestylePeriodSummaries;
    vsPrevious: {
        trainingAdherencePercent: number | null;
        workoutsCompleted: number | null;
        missedWorkouts: number | null;
        avgDurationMin: number | null;
        volumeKg: number | null;
        volumePercent: number | null;
        prCount: number | null;
        bodyweightAverageKg: number | null;
        bodyweightChangeKg: number | null;
        checkInCompletionPercent: number | null;
        caloriesAverage: number | null;
        stepsAverage: number | null;
        sleepAverage: number | null;
    };
}

export interface CoachActiveWorkout {
    logId: string;
    workoutId: string;
    name: string;
    startedAt: string;
    elapsedMinutes: number | null;
    completedSets: number;
    totalSets: number;
    completedExercises: number;
    totalExercises: number;
    href: string;
}

export interface CoachLatestCheckIn {
    id: string;
    submittedAt: string;
    weekNumber: number;
    periodTitle: string;
    bodyweightKg: number | null;
    notes: string | null;
    feedback: string | null;
    needsReview: boolean;
    reviewStatus: "Pending" | "Reviewed";
    ratings: Array<{ key: string; label: string; value: number | null }>;
    photos: { front: string | null; side: string | null };
}

export interface CoachRecentSession {
    id: string;
    workoutId: string;
    workoutName: string;
    date: string;
    durationMin: number | null;
    exerciseCount: number;
    setCount: number;
    volumeKg: number | null;
    prCount: number | null;
    status: "COMPLETED";
    vsPreviousVolumePercent: number | null;
}

export interface CoachPlanProgress {
    id: string;
    name: string;
    currentWeek: number | null;
    totalWeeks: number;
    weekCompleted: number;
    weekScheduled: number;
    planEnded: boolean;
}

export interface CoachClientProfileInsights {
    periods: Record<CoachProfilePeriodKey, CoachProfilePeriodSnapshot>;
    currentStreak: number | null;
    weightDirection: WeightDirection | null;
    weightTrend: "toward" | "away" | "stable" | null;
    activeWorkout: CoachActiveWorkout | null;
    attention: CoachAttentionItem[];
    planProgress: CoachPlanProgress | null;
    latestCheckIn: CoachLatestCheckIn | null;
    recentSessions: CoachRecentSession[];
    coachNotes: CoachClientNote[];
    canViewCheckInPhotos: boolean;
}

const CHECK_IN_RATING_LABELS: Array<{ key: string; field: string; label: string }> = [
    { key: "sleep", field: "sleepRating", label: "Sleep" },
    { key: "diet", field: "dietRating", label: "Diet" },
    { key: "stress", field: "stressRating", label: "Stress" },
    { key: "energy", field: "energyRating", label: "Energy" },
    { key: "intensity", field: "intensityRating", label: "Intensity" },
    { key: "injury", field: "injuryRating", label: "Soreness" },
];

function formatMissedDateLabel(dateKey: string, todayKey: string): string {
    if (dateKey === shiftAppDateKey(todayKey, -1)) return "Yesterday";
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        weekday: "long",
        day: "numeric",
        month: "short",
    }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

function inRange(dateIso: string, startDateKey: string, endDateKey: string): boolean {
    const key = toDateKey(new Date(dateIso));
    return key >= startDateKey && key <= endDateKey;
}

export async function loadCoachClientProfileInsights(input: {
    actor: { id: string; role: string };
    client: {
        id: string;
        coachId: string | null;
        createdAt: Date;
        isCoachPaused: boolean;
        coachResumedAt?: Date | null;
        targetWeightKg: number | null;
        targetCalories: number | null;
        targetSteps: number | null;
        targetSleepHours: number | null;
        checkInFrequencyWeeks: number | null;
    };
    canEdit: boolean;
    checkInDueState: CheckInDueState;
    currentStreak: number;
    historicalMissedSessions?: Array<{ dateKey: string; workoutId: string }>;
    activeUserPlan: ActiveUserPlanLike | null;
    planName: string | null;
    planId: string | null;
    excusedMissedWorkoutKeys: Iterable<string>;
    completedLogs: Array<{
        id: string;
        workoutId: string;
        workoutName: string;
        loggedAt: Date;
        duration: number | null;
        sets: Array<{
            isCompleted: boolean;
            isWarmup: boolean;
            isPR?: boolean | null;
            reps: number | null;
            weightKg: number | null;
            exerciseId?: string | null;
        }>;
    }>;
    bodyweightHistory: Array<{ date: string; weightKg: number }>;
    checkInSubmittedAt: string[];
}): Promise<CoachClientProfileInsights> {
    const todayKey = getLocalTimeParts(new Date(), APP_TIMEZONE).dateKey;
    const today = parseLogDate(todayKey);
    const accountCreatedKey = toDateKey(input.client.createdAt);
    const lookbackStart = shiftAppDateKey(todayKey, -(365 * 2 - 1));

    const completedForAdherence: CompletedWorkoutLog[] = input.completedLogs.map((log) => ({
        workoutId: log.workoutId,
        dateKey: toDateKey(log.loggedAt),
    }));

    const [
        dailyMetricRows,
        latestCheckInRow,
        inProgressLog,
        coachNotes,
        canViewPhotos,
    ] = await Promise.all([
        getDailyMetricsInRange(input.client.id, lookbackStart, todayKey),
        prisma.checkIn.findFirst({
            where: { userId: input.client.id },
            orderBy: { createdAt: "desc" },
        }),
        prisma.workoutLog.findFirst({
            where: {
                userId: input.client.id,
                status: "IN_PROGRESS",
                updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            include: {
                workout: { select: { name: true } },
                sets: { select: { isCompleted: true, isWarmup: true, exerciseId: true } },
            },
            orderBy: { updatedAt: "desc" },
        }),
        listCoachClientNotes(input.client.id),
        canViewProgressPhotos(input.actor, {
            id: input.client.id,
            coachId: input.client.coachId,
        }),
    ]);

    const latestWeight = input.bodyweightHistory.length > 0
        ? input.bodyweightHistory[input.bodyweightHistory.length - 1].weightKg
        : null;
    const baselineWeight = input.bodyweightHistory.length > 0
        ? input.bodyweightHistory[0].weightKg
        : latestWeight;
    const weightDirection = resolveWeightDirection(input.client.targetWeightKg, baselineWeight);

    const targets = {
        targetCalories: input.client.targetCalories,
        targetSteps: input.client.targetSteps,
        targetSleepHours: input.client.targetSleepHours,
    };

    const periods = {} as Record<CoachProfilePeriodKey, CoachProfilePeriodSnapshot>;

    for (const meta of COACH_PROFILE_PERIODS) {
        const current = periodWindow(todayKey, meta.days);
        const previous = previousPeriodWindow(current.startDateKey, meta.days);
        const currentStart = clampPeriodStart(current.startDateKey, accountCreatedKey);
        const previousStart = clampPeriodStart(previous.startDateKey, accountCreatedKey);

        const currentTraining = computePeriodTrainingStats({
            activeUserPlan: input.activeUserPlan,
            completedLogs: completedForAdherence,
            excusedMissedWorkoutKeys: input.excusedMissedWorkoutKeys,
            historicalMissedSessions: input.historicalMissedSessions,
            today,
            startDateKey: currentStart,
            endDateKey: current.endDateKey,
        });
        const previousTraining = computePeriodTrainingStats({
            activeUserPlan: input.activeUserPlan,
            completedLogs: completedForAdherence,
            excusedMissedWorkoutKeys: input.excusedMissedWorkoutKeys,
            historicalMissedSessions: input.historicalMissedSessions,
            today,
            startDateKey: previousStart,
            endDateKey: previous.endDateKey,
        });

        const currentLogs = input.completedLogs.filter((log) =>
            inRange(log.loggedAt.toISOString(), currentStart, current.endDateKey)
        );
        const previousLogs = input.completedLogs.filter((log) =>
            inRange(log.loggedAt.toISOString(), previousStart, previous.endDateKey)
        );

        const durationValues = currentLogs
            .map((log) => log.duration)
            .filter((value): value is number => typeof value === "number" && value > 0);
        const previousDurations = previousLogs
            .map((log) => log.duration)
            .filter((value): value is number => typeof value === "number" && value > 0);

        const volumeOf = (logs: typeof currentLogs) => {
            const values = logs.map((log) =>
                log.sets.reduce((sum, set) => {
                    if (!set.isCompleted || set.isWarmup) return sum;
                    return sum + (set.reps || 0) * (set.weightKg || 0);
                }, 0)
            );
            const total = values.reduce((sum, value) => sum + value, 0);
            return logs.length > 0 ? Math.round(total) : null;
        };

        const prsOf = (logs: typeof currentLogs) => {
            if (logs.length === 0) return null;
            return logs.reduce((sum, log) => (
                sum + log.sets.filter((set) => set.isCompleted && !set.isWarmup && set.isPR).length
            ), 0);
        };

        const currentBw = computePeriodBodyweightStats(
            input.bodyweightHistory,
            currentStart,
            current.endDateKey
        );
        const previousBw = computePeriodBodyweightStats(
            input.bodyweightHistory,
            previousStart,
            previous.endDateKey
        );

        const currentCheckIns = computePeriodCheckInStats(
            input.checkInSubmittedAt,
            currentStart,
            current.endDateKey,
            input.client.checkInFrequencyWeeks
        );
        const previousCheckIns = computePeriodCheckInStats(
            input.checkInSubmittedAt,
            previousStart,
            previous.endDateKey,
            input.client.checkInFrequencyWeeks
        );

        const currentExpected = expectedDaysInWindow(current.startDateKey, current.endDateKey, accountCreatedKey);
        const previousExpected = expectedDaysInWindow(previous.startDateKey, previous.endDateKey, accountCreatedKey);
        const currentLifestyle = summarizeLifestylePeriod(
            dailyMetricRows.filter((row) => row.date >= currentStart && row.date <= current.endDateKey),
            targets,
            currentExpected
        );
        const previousLifestyle = summarizeLifestylePeriod(
            dailyMetricRows.filter((row) => row.date >= previousStart && row.date <= previous.endDateKey),
            targets,
            previousExpected
        );

        const lastTrained = currentLogs.reduce<Date | null>((latest, log) => {
            if (!latest || log.loggedAt > latest) return log.loggedAt;
            return latest;
        }, null) ?? input.completedLogs.reduce<Date | null>((latest, log) => {
            if (!latest || log.loggedAt > latest) return log.loggedAt;
            return latest;
        }, null);

        periods[meta.key] = {
            key: meta.key,
            label: meta.label,
            previousLabel: meta.previousLabel,
            startDateKey: currentStart,
            endDateKey: current.endDateKey,
            trainingAdherencePercent: currentTraining.adherencePercent,
            workoutsCompleted: currentTraining.completed,
            workoutsScheduled: currentTraining.scheduled,
            missedWorkouts: currentTraining.missed,
            avgDurationMin: durationValues.length > 0
                ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
                : null,
            volumeKg: volumeOf(currentLogs),
            prCount: prsOf(currentLogs),
            lastTrainedAt: lastTrained ? lastTrained.toISOString() : null,
            bodyweightCurrentKg: currentBw.currentKg,
            bodyweightAverageKg: currentBw.averageKg,
            bodyweightChangeKg: currentBw.changeKg,
            checkInSubmitted: currentCheckIns.submitted,
            checkInExpected: currentCheckIns.expected,
            checkInCompletionPercent: currentCheckIns.completionPercent,
            lifestyle: currentLifestyle,
            vsPrevious: {
                trainingAdherencePercent: numericDelta(currentTraining.adherencePercent, previousTraining.adherencePercent),
                workoutsCompleted: previousLogs.length === 0 && currentTraining.completed === 0
                    ? null
                    : previousTraining.scheduled > 0 || currentTraining.scheduled > 0
                        ? numericDelta(currentTraining.completed, previousTraining.completed)
                        : currentLogs.length > 0 || previousLogs.length > 0
                            ? numericDelta(currentLogs.length, previousLogs.length)
                            : null,
                missedWorkouts: currentTraining.scheduled > 0 || previousTraining.scheduled > 0
                    ? numericDelta(currentTraining.missed, previousTraining.missed)
                    : null,
                avgDurationMin: numericDelta(
                    durationValues.length > 0
                        ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
                        : null,
                    previousDurations.length > 0
                        ? Math.round(previousDurations.reduce((sum, value) => sum + value, 0) / previousDurations.length)
                        : null
                ),
                volumeKg: numericDelta(volumeOf(currentLogs), volumeOf(previousLogs)),
                volumePercent: percentDelta(volumeOf(currentLogs), volumeOf(previousLogs)),
                prCount: numericDelta(prsOf(currentLogs), prsOf(previousLogs)),
                bodyweightAverageKg: numericDelta(currentBw.averageKg, previousBw.averageKg),
                bodyweightChangeKg: currentBw.changeKg,
                checkInCompletionPercent: numericDelta(
                    currentCheckIns.completionPercent,
                    previousCheckIns.completionPercent
                ),
                caloriesAverage: numericDelta(currentLifestyle.calories.average, previousLifestyle.calories.average),
                stepsAverage: numericDelta(currentLifestyle.steps.average, previousLifestyle.steps.average),
                sleepAverage: numericDelta(currentLifestyle.sleep.average, previousLifestyle.sleep.average),
            },
        };
    }

    const month = periods["30d"];
    const planEnded = Boolean(
        input.activeUserPlan
        && isDateAfterPlanEnd(input.activeUserPlan.startedAt, input.activeUserPlan.plan.weeks.length, todayKey)
    );

    const excusedKeys = new Set(input.excusedMissedWorkoutKeys);
    const missedWorkouts = [];
    if (input.activeUserPlan && !planEnded) {
        for (const dateKey of eachDateKeyInclusive(shiftAppDateKey(todayKey, -3), shiftAppDateKey(todayKey, -1)).reverse()) {
            const planned = getPlannedWorkoutForDate(input.activeUserPlan, parseLogDate(dateKey), {
                today,
                dateKey,
            });
            if (!planned || !isScheduledTrainingWorkout(planned)) continue;
            const slotKey = `${dateKey}:${planned.id}`;
            if (excusedKeys.has(slotKey)) continue;
            if (completedForAdherence.some((log) => log.dateKey === dateKey && log.workoutId === planned.id)) continue;
            missedWorkouts.push({
                dateKey,
                dateLabel: formatMissedDateLabel(dateKey, todayKey),
                workoutId: planned.id,
                workoutName: planned.name,
            });
        }
    }

    const latestCheckIn = latestCheckInRow
        ? {
            id: latestCheckInRow.id,
            submittedAt: latestCheckInRow.createdAt.toISOString(),
            weekNumber: latestCheckInRow.weekNumber,
            periodTitle: formatCheckInPeriodTitle(latestCheckInRow.weekNumber, latestCheckInRow.createdAt.toISOString()),
            bodyweightKg: latestCheckInRow.bodyweightKg,
            notes: latestCheckInRow.notes,
            feedback: latestCheckInRow.feedback,
            needsReview: latestCheckInRow.status === "PENDING" || !latestCheckInRow.coachResponse,
            reviewStatus: (latestCheckInRow.coachResponse ? "Reviewed" : "Pending") as "Pending" | "Reviewed",
            ratings: CHECK_IN_RATING_LABELS.map((item) => ({
                key: item.key,
                label: item.label,
                value: (latestCheckInRow as Record<string, unknown>)[item.field] as number | null,
            })),
            photos: {
                front: canViewPhotos && latestCheckInRow.frontImageUrl
                    ? resolveUploadUrl(latestCheckInRow.frontImageUrl)
                    : null,
                side: canViewPhotos && latestCheckInRow.sideImageUrl
                    ? resolveUploadUrl(latestCheckInRow.sideImageUrl)
                    : null,
            },
        }
        : null;

    const attention = buildCoachClientAttentionItems({
        canEdit: input.canEdit,
        clientId: input.client.id,
        isCoachPaused: input.client.isCoachPaused,
        coachResumedAt: input.client.coachResumedAt,
        hasActivePlan: Boolean(input.activeUserPlan),
        planEnded,
        checkInDueState: input.checkInDueState,
        latestCheckIn: latestCheckIn
            ? { id: latestCheckIn.id, needsReview: latestCheckIn.needsReview }
            : null,
        missedWorkouts,
        trainingAdherencePercent: month.trainingAdherencePercent,
        trainingScheduled: month.workoutsScheduled,
        steps: month.lifestyle.steps,
    });

    let activeWorkout: CoachActiveWorkout | null = null;
    if (inProgressLog) {
        const workingSets = inProgressLog.sets.filter((set) => !set.isWarmup);
        const exerciseIds = [...new Set(workingSets.map((set) => set.exerciseId).filter(Boolean))];
        const completedExerciseIds = new Set(
            workingSets.filter((set) => set.isCompleted).map((set) => set.exerciseId).filter(Boolean)
        );
        const startedAt = inProgressLog.loggedAt;
        const elapsedMs = Date.now() - startedAt.getTime();
        activeWorkout = {
            logId: inProgressLog.id,
            workoutId: inProgressLog.workoutId,
            name: inProgressLog.workout.name,
            startedAt: startedAt.toISOString(),
            elapsedMinutes: elapsedMs > 0 && elapsedMs < 12 * 60 * 60 * 1000
                ? Math.max(1, Math.round(elapsedMs / 60000))
                : null,
            completedSets: workingSets.filter((set) => set.isCompleted).length,
            totalSets: workingSets.length,
            completedExercises: completedExerciseIds.size,
            totalExercises: exerciseIds.length,
            href: `/plans/log/view/${inProgressLog.id}`,
        };
    }

    let planProgress: CoachPlanProgress | null = null;
    if (input.activeUserPlan && input.planId && input.planName) {
        const weekCount = input.activeUserPlan.plan.weeks.length;
        const diffDays = getPlanDayOffset(input.activeUserPlan.startedAt, today, todayKey);
        const currentWeek = getPlanProgramWeekNumber(weekCount, diffDays);
        const weekIndex = getCurrentPlanWeekIndex(input.activeUserPlan, today);
        const week = input.activeUserPlan.plan.weeks[weekIndex];
        const weekScheduled = week ? countPlannedTrainingSessions(week.workouts) : 0;
        const weekStartOffset = weekIndex * 7;
        const weekStartKey = shiftAppDateKey(toDateKey(new Date(input.activeUserPlan.startedAt)), weekStartOffset);
        const weekEndKey = shiftAppDateKey(weekStartKey, 6);
        const weekWorkoutIds = new Set((week?.workouts ?? []).filter(isScheduledTrainingWorkout).map((w) => w.id));
        const weekCompleted = input.completedLogs.filter((log) => {
            const key = toDateKey(log.loggedAt);
            return key >= weekStartKey && key <= weekEndKey && weekWorkoutIds.has(log.workoutId);
        }).length;
        planProgress = {
            id: input.planId,
            name: input.planName,
            currentWeek,
            totalWeeks: weekCount,
            weekCompleted,
            weekScheduled,
            planEnded,
        };
    }

    const sortedLogs = [...input.completedLogs].sort(
        (a, b) => b.loggedAt.getTime() - a.loggedAt.getTime()
    );
    const recentSessions: CoachRecentSession[] = sortedLogs.slice(0, 12).map((log) => {
        const workingSets = log.sets.filter((set) => set.isCompleted && !set.isWarmup);
        const volume = workingSets.reduce((sum, set) => sum + (set.reps || 0) * (set.weightKg || 0), 0);
        const previous = sortedLogs.find((other) => (
            other.workoutId === log.workoutId
            && other.id !== log.id
            && other.loggedAt.getTime() < log.loggedAt.getTime()
        )) ?? null;
        const previousVolume = previous
            ? previous.sets
                .filter((set) => set.isCompleted && !set.isWarmup)
                .reduce((sum, set) => sum + (set.reps || 0) * (set.weightKg || 0), 0)
            : null;
        return {
            id: log.id,
            workoutId: log.workoutId,
            workoutName: log.workoutName,
            date: log.loggedAt.toISOString(),
            durationMin: log.duration && log.duration > 0 ? log.duration : null,
            exerciseCount: new Set(workingSets.map((set) => set.exerciseId).filter(Boolean)).size,
            setCount: workingSets.length,
            volumeKg: workingSets.length > 0 ? Math.round(volume) : null,
            prCount: workingSets.some((set) => set.isPR) || workingSets.length > 0
                ? workingSets.filter((set) => set.isPR).length
                : null,
            status: "COMPLETED" as const,
            vsPreviousVolumePercent: percentDelta(
                workingSets.length > 0 ? volume : null,
                previousVolume != null && previousVolume > 0 ? previousVolume : null
            ),
        };
    });

    const monthChange = month.bodyweightChangeKg;
    const weightTrend = interpretWeightChange(monthChange, weightDirection);

    return {
        periods,
        currentStreak: input.currentStreak > 0 || input.activeUserPlan ? input.currentStreak : null,
        weightDirection,
        weightTrend,
        activeWorkout,
        attention,
        planProgress,
        latestCheckIn,
        recentSessions,
        coachNotes,
        canViewCheckInPhotos: canViewPhotos,
    };
}
