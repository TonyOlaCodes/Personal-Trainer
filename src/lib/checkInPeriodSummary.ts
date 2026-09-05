import { prisma } from "@/lib/prisma";
import { addDaysToDateStr, ensureBodyweightTable, getBodyweightAverageInRange } from "@/lib/bodyweight";
import { clampPeriodStart, expectedDaysInWindow } from "@/lib/coachClientPeriodStats";
import {
    buildLifestyleCheckInCopy,
    hasEnoughLifestyleAssessmentData,
    lifestyleMetFlag,
    resolveLifestyleVerdict,
    type LifestyleCheckInVerdict,
} from "@/lib/checkInLifestyleNotes";
import { ensureDailyMetricsTable, getDailyMetricTargets, getDailyMetricsInRange } from "@/lib/dailyMetrics";
import { getUserCheckInSchedule, type CheckInSchedule } from "@/lib/checkInSchedule";
import {
    buildScheduledPeriod,
    formatScheduledPeriodLabel,
    isCheckInScheduleConfigured,
    scheduledPeriodContainingDate,
    scheduledPeriodWindow,
} from "@/lib/checkInPeriods";
import { isLifestyleShownOnDashboard } from "@/lib/lifestyleDashboardVisibility";
import { summarizeLifestylePeriod, type LifestyleMetricKey } from "@/lib/lifestylePeriodMetrics";
import { getWorkoutsTargetFromUserPlan } from "@/lib/planTrainingTarget";
import { APP_TIMEZONE, dateKeyToUtcNoon, shiftAppDateKey } from "@/lib/appTimezone";
import { localDayBoundsUtc } from "@/lib/coachNotificationSchedule";
import { formatDate, getWeekNumber, toDateKey } from "@/lib/utils";

export type CheckInLifestyleMetricSummary = {
    average: number | null;
    target: number | null;
    daysLogged: number;
    expectedDays: number;
    loggingRatePercent: number;
    onTargetDays: number | null;
    onTargetPercent: number | null;
    metGoal: boolean | null;
    enoughData: boolean;
    verdict: LifestyleCheckInVerdict;
    message: string;
    detail: string;
};

export type CheckInPeriodSummary = {
    periodDays: number;
    periodStartDateKey: string;
    periodEndDateKey: string;
    periodLabel: string;
    frequencyWeeks: number;
    weight: {
        /** Period average bodyweight (primary stat). */
        currentKg: number | null;
        /** Average bodyweight during the previous check-in period. */
        baselineKg: number | null;
        /** Period average minus previous check-in period average. */
        changeKg: number | null;
        entries: number;
        towardGoal: boolean | null;
        targetKg: number | null;
        hasPreviousCheckIn: boolean;
        /** Human-readable window for the current average, e.g. "since last check-in". */
        windowLabel: string;
        message: string;
        detail: string;
    } | null;
    calories: CheckInLifestyleMetricSummary | null;
    steps: CheckInLifestyleMetricSummary | null;
    sleep: CheckInLifestyleMetricSummary | null;
    workouts: {
        completed: number;
        skipped: number;
        target: number;
        completionPercent: number;
        prCount: number;
        message: string;
        detail: string;
    };
    overallHeadline: string;
    overallProgress: string[];
    overallAttention: string[];
    overallNextSteps: string[];
    overallUnassessed: string[];
};

export function getCheckInPeriodDays(schedule: Pick<CheckInSchedule, "frequencyWeeks">): number {
    const weeks = schedule.frequencyWeeks && schedule.frequencyWeeks > 0 ? schedule.frequencyWeeks : 1;
    return weeks * 7;
}

export function getCheckInPeriodLabel(frequencyWeeks: number): string {
    if (frequencyWeeks <= 1) return "the last 7 days";
    if (frequencyWeeks === 2) return "the last 14 days";
    return `the last ${frequencyWeeks} weeks`;
}

/** Max kg change per week considered "on track" for bulking / cutting / maintenance. */
const GRADUAL_GAIN_KG_PER_WEEK = 1.0;
const GRADUAL_LOSS_KG_PER_WEEK = 1.2;
const MAINTENANCE_KG_PER_WEEK = 0.8;

export function isWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    frequencyWeeks: number
): boolean {
    const weeks = Math.max(1, frequencyWeeks);
    const absChange = Math.abs(changeKg);

    if (absChange < 0.15) return true;

    switch (goal) {
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return changeKg > 0 && changeKg <= GRADUAL_GAIN_KG_PER_WEEK * weeks;
        case "LOSE_WEIGHT":
            return changeKg < 0 && absChange <= GRADUAL_LOSS_KG_PER_WEEK * weeks;
        case "RECOMPOSITION":
            return absChange <= MAINTENANCE_KG_PER_WEEK * weeks;
        default:
            return absChange <= MAINTENANCE_KG_PER_WEEK * weeks;
    }
}

/** Inclusive window after the previous submitted check-in, or since account start. */
export function getCheckInAnalysisWindow(
    periodEndDate: string,
    priorCheckInDate: string | null,
    accountCreatedAt: Date | string
): { startDateKey: string; endDateKey: string } {
    const endDateKey = periodEndDate;
    const accountStart = typeof accountCreatedAt === "string" ? accountCreatedAt : toDateKey(accountCreatedAt);
    const rawStart = priorCheckInDate ? addDaysToDateStr(priorCheckInDate, 1) : accountStart;
    const startDateKey = clampPeriodStart(rawStart, accountStart);

    return {
        startDateKey: startDateKey > endDateKey ? endDateKey : startDateKey,
        endDateKey,
    };
}

function formatCheckInAnalysisLabel(startDateKey: string, endDateKey: string, hasPreviousCheckIn: boolean): string {
    const start = formatDate(startDateKey, { year: undefined });
    const end = formatDate(endDateKey);
    if (hasPreviousCheckIn) return `${start} – ${end}`;
    return `${start} – ${end} (since you started)`;
}

async function findPreviousCheckIn(userId: string, referenceDate: string) {
    return prisma.checkIn.findFirst({
        where: {
            userId,
            createdAt: { lt: localDayBoundsUtc(referenceDate, APP_TIMEZONE).start },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, bodyweightKg: true },
    });
}

/** Average bodyweight logged since the user's previous check-in (or since account start). */
export async function getBodyweightAverageSinceLastCheckIn(
    userId: string,
    referenceDate: string,
    accountCreatedAt: Date
): Promise<{
    averageWeightKg: number | null;
    entries: number;
    startDateStr: string;
    endDateStr: string;
    hasPreviousCheckIn: boolean;
    windowLabel: string;
}> {
    await ensureBodyweightTable();

    const previousCheckIn = await findPreviousCheckIn(userId, referenceDate);
    const priorCheckInDate = previousCheckIn ? toDateKey(previousCheckIn.createdAt) : null;
    const window = getCheckInAnalysisWindow(referenceDate, priorCheckInDate, accountCreatedAt);
    const { averageWeightKg, entries } = await getBodyweightAverageInRange(
        userId,
        window.startDateKey,
        window.endDateKey
    );

    return {
        averageWeightKg,
        entries,
        startDateStr: window.startDateKey,
        endDateStr: window.endDateKey,
        hasPreviousCheckIn: previousCheckIn != null,
        windowLabel: previousCheckIn ? "since last check-in" : "logged so far",
    };
}

function round2(n: number) {
    return Math.round(n * 100) / 100;
}

function buildWeightAdvice(
    changeKg: number | null,
    towardGoal: boolean | null,
    goal: string | null | undefined,
    weightWindowLabel: string,
    hasPreviousCheckIn: boolean
): { message: string; detail: string } {
    if (!hasPreviousCheckIn) {
        return {
            message: "Building your baseline",
            detail: "Keep logging weight when you can. Your next check-in will have a clearer trend to compare against.",
        };
    }

    if (changeKg === null) {
        return {
            message: "Not enough weight data",
            detail: "There is not enough weight data logged since your last check-in to assess the trend yet.",
        };
    }

    const isBulking = goal === "GAIN_MUSCLE" || goal === "STRENGTH";
    const isCutting = goal === "LOSE_WEIGHT";

    if (towardGoal === true) {
        if (Math.abs(changeKg) < 0.15) {
            return {
                message: "Holding steady",
                detail: `Your average stayed close to your last check-in (${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg).`,
            };
        }
        if (isBulking) {
            return {
                message: "Gradual gain on track",
                detail: `Up ${Math.abs(changeKg).toFixed(1)} kg since last check-in. That pace looks reasonable for your goal.`,
            };
        }
        if (isCutting) {
            return {
                message: "Gradual loss on track",
                detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in. That pace looks reasonable for your goal.`,
            };
        }
        return {
            message: "Staying on target",
            detail: `Your average moved ${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg since last check-in and remains in a reasonable range.`,
        };
    }

    if (towardGoal === false) {
        if (isBulking) {
            return changeKg < 0
                ? {
                    message: "Weight moved the wrong way",
                    detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in while your goal is to gain. Discuss this with your coach if it continues.`,
                }
                : {
                    message: "Gain came faster than ideal",
                    detail: `Up ${changeKg.toFixed(1)} kg since last check-in. That is faster than ideal for a lean gain — worth reviewing with your coach.`,
                };
        }
        if (isCutting) {
            return changeKg > 0
                ? {
                    message: "Weight crept up",
                    detail: `Up ${changeKg.toFixed(1)} kg since last check-in while your goal is to lose. Review consistency with your coach if needed.`,
                }
                : {
                    message: "Loss came faster than ideal",
                    detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in. That is a sharp change — mention it to your coach if recovery or performance is affected.`,
                };
        }
        return {
            message: "Larger shift than planned",
            detail: `${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg since last check-in. Review intake and activity with your coach if this was not intended.`,
        };
    }

    return {
        message: changeKg === 0 ? "No change" : changeKg > 0 ? "Trending up" : "Trending down",
        detail: `${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg since last check-in.`,
    };
}

function workoutCompletionPercent(completed: number, target: number): number {
    if (target <= 0) return completed > 0 ? 100 : 0;
    return Math.min(100, Math.round((completed / target) * 100));
}

function buildWorkoutAdvice(completed: number, target: number): { message: string; detail: string; completionPercent: number } {
    const percent = workoutCompletionPercent(completed, target);
    const sessionLabel = `${completed} of ${target} planned workout${target === 1 ? "" : "s"}`;

    if (target <= 0) {
        return {
            completionPercent: percent,
            message: `${completed} session${completed === 1 ? "" : "s"} logged`,
            detail: "No session target set for this period.",
        };
    }

    if (percent >= 100) {
        return {
            completionPercent: percent,
            message: "Perfect consistency",
            detail: `You completed every planned workout this period (${completed}/${target}). Keep that rhythm.`,
        };
    }

    if (percent >= 80) {
        return {
            completionPercent: percent,
            message: "Strong consistency",
            detail: `${sessionLabel} completed. That is a solid training period.`,
        };
    }

    if (percent >= 60) {
        return {
            completionPercent: percent,
            message: "Decent consistency",
            detail: `${sessionLabel} completed. There is room to improve consistency next period.`,
        };
    }

    if (percent >= 40) {
        return {
            completionPercent: percent,
            message: "Patchy consistency",
            detail: `${sessionLabel} completed. Several planned sessions were missed this period.`,
        };
    }

    if (percent >= 20) {
        return {
            completionPercent: percent,
            message: "Low consistency",
            detail: `${sessionLabel} completed. Training consistency dropped this period — discuss barriers with your coach if needed.`,
        };
    }

    if (percent >= 1) {
        return {
            completionPercent: percent,
            message: "Very low consistency",
            detail: `Training was minimal this period (${sessionLabel}). Rebuilding routine one session at a time is a sensible next step.`,
        };
    }

    return {
        completionPercent: percent,
        message: "No workouts completed",
        detail: `No planned workouts were completed this period (${completed}/${target}). Start with the next scheduled session and rebuild from there.`,
    };
}

function pushLifestyleOverview(
    metric: CheckInLifestyleMetricSummary | null,
    label: string,
    progress: string[],
    attention: string[],
    unassessed: string[]
) {
    if (!metric) return;
    if (metric.verdict === "insufficient" || metric.verdict === "no-target") {
        unassessed.push(label);
        return;
    }
    if (metric.verdict === "good") progress.push(`${label} stayed close to target.`);
    else attention.push(`${label} ${metric.verdict === "low" ? "sat below" : "sat above"} target.`);
}

function buildOverallOverview(input: {
    weight: CheckInPeriodSummary["weight"];
    calories: CheckInPeriodSummary["calories"];
    steps: CheckInPeriodSummary["steps"];
    sleep: CheckInPeriodSummary["sleep"];
    workouts: CheckInPeriodSummary["workouts"];
    isWeightHidden: boolean;
}): Pick<CheckInPeriodSummary, "overallHeadline" | "overallProgress" | "overallAttention" | "overallNextSteps" | "overallUnassessed"> {
    const progress: string[] = [];
    const attention: string[] = [];
    const nextSteps: string[] = [];
    const unassessed: string[] = [];

    if (!input.isWeightHidden) {
        if (!input.weight || input.weight.currentKg == null) {
            unassessed.push("Weight trend");
        } else if (input.weight.towardGoal === true) {
            progress.push("Weight trend looks aligned with your goal.");
        } else if (input.weight.towardGoal === false) {
            attention.push("Weight trend moved away from your goal this period.");
        }
    }

    pushLifestyleOverview(input.calories, "Calories", progress, attention, unassessed);
    pushLifestyleOverview(input.steps, "Steps", progress, attention, unassessed);
    pushLifestyleOverview(input.sleep, "Sleep", progress, attention, unassessed);

    if (input.workouts.completionPercent >= 80) {
        progress.push("Training consistency was strong this period.");
    } else if (input.workouts.completionPercent < 50) {
        attention.push("Several planned workouts were missed this period.");
    }

    if (attention.some((line) => line.includes("workout")) || input.workouts.completionPercent < 80) {
        nextSteps.push("Aim to complete your scheduled workouts where possible.");
    }
    if (unassessed.length > 0) {
        nextSteps.push("Log missing metrics so the next summary can be more complete.");
    }
    if (attention.length > 0) {
        nextSteps.push("Raise anything you are unsure about with your coach.");
    }
    if (nextSteps.length === 0) {
        nextSteps.push("Keep your current habits consistent into the next period.");
    }

    let headline = "A steady period based on the data available.";
    if (progress.length >= 2 && attention.length === 0) {
        headline = "A strong period overall based on your logged data.";
    } else if (attention.length >= 2) {
        headline = "A few areas need attention this period.";
    } else if (progress.length >= 1 && attention.length >= 1) {
        headline = "A mixed period with some wins and some gaps.";
    }

    return {
        overallHeadline: headline,
        overallProgress: progress,
        overallAttention: attention,
        overallNextSteps: nextSteps,
        overallUnassessed: unassessed,
    };
}

export async function getWorkoutsTargetPerWeek(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            trainingDaysPerWeek: true,
            plans: {
                where: { isActive: true },
                include: {
                    plan: {
                        include: {
                            weeks: {
                                orderBy: { weekNumber: "asc" },
                                include: {
                                    workouts: {
                                        include: { exercises: { select: { id: true }, take: 1 } },
                                    },
                                },
                            },
                        },
                    },
                },
                take: 1,
            },
        },
    });

    if (!user) return 4;

    return getWorkoutsTargetFromUserPlan(
        user.trainingDaysPerWeek,
        user.plans[0]
            ? {
                startedAt: user.plans[0].startedAt,
                plan: user.plans[0].plan,
            }
            : null
    );
}

export async function getCheckInPeriodSummary(
    userId: string,
    referenceDate: string,
    options?: {
        schedule?: CheckInSchedule;
        hiddenGoals?: string[];
        periodDueDateKey?: string;
    }
): Promise<CheckInPeriodSummary> {
    await Promise.all([ensureBodyweightTable(), ensureDailyMetricsTable()]);

    const [user, schedule, metricTargets, workoutsPerWeek] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { createdAt: true, goal: true, targetWeightKg: true, hiddenGoals: true },
        }),
        options?.schedule ? Promise.resolve(options.schedule) : getUserCheckInSchedule(userId),
        getDailyMetricTargets(userId),
        getWorkoutsTargetPerWeek(userId),
    ]);

    if (!user) {
        throw new Error("User not found");
    }

    const hiddenGoals = options?.hiddenGoals ?? user.hiddenGoals ?? [];
    const isWeightHidden = hiddenGoals.includes("weight");
    const frequencyWeeks = schedule.frequencyWeeks && schedule.frequencyWeeks > 0 ? schedule.frequencyWeeks : 1;

    const scheduledPeriod = options?.periodDueDateKey
        ? buildScheduledPeriod(options.periodDueDateKey, frequencyWeeks, referenceDate)
        : isCheckInScheduleConfigured(schedule)
            ? scheduledPeriodContainingDate(schedule, referenceDate, referenceDate)
            : null;
    const startDateKey = scheduledPeriod?.startDateKey
        ?? scheduledPeriodWindow(referenceDate, frequencyWeeks).startDateKey;
    const endDateKey = scheduledPeriod?.endDateKey ?? referenceDate;
    const previousDueDateKey = scheduledPeriod
        ? shiftAppDateKey(scheduledPeriod.dueDateKey, -(frequencyWeeks * 7))
        : null;
    const previousWindow = previousDueDateKey
        ? scheduledPeriodWindow(previousDueDateKey, frequencyWeeks)
        : null;

    const previousCheckIn = previousDueDateKey
        ? await prisma.checkIn.findFirst({
            where: {
                userId,
                OR: [
                    { periodDueDateKey: previousDueDateKey },
                    { weekNumber: getWeekNumber(dateKeyToUtcNoon(previousDueDateKey)) },
                ],
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, bodyweightKg: true, periodDueDateKey: true },
        })
        : await findPreviousCheckIn(userId, referenceDate);
    const periodDays = expectedDaysInWindow(startDateKey, endDateKey, toDateKey(user.createdAt));
    const periodLabel = scheduledPeriod?.label
        ?? formatScheduledPeriodLabel(startDateKey, endDateKey);
    const { start: effectiveStart } = localDayBoundsUtc(startDateKey, APP_TIMEZONE);
    const { end } = localDayBoundsUtc(endDateKey, APP_TIMEZONE);

    let weightSummary: CheckInPeriodSummary["weight"] = null;
    if (!isWeightHidden) {
        const periodRows = await getBodyweightAverageInRange(
            userId,
            startDateKey,
            endDateKey
        );

        const averageKg = periodRows.averageWeightKg != null ? round2(periodRows.averageWeightKg) : null;

        let baselineKg: number | null = null;
        if (previousWindow) {
            const prevPeriodRows = await getBodyweightAverageInRange(
                userId,
                previousWindow.startDateKey,
                previousWindow.endDateKey
            );

            if (prevPeriodRows.averageWeightKg != null) {
                baselineKg = round2(prevPeriodRows.averageWeightKg);
            } else if (previousCheckIn?.bodyweightKg != null) {
                baselineKg = round2(previousCheckIn.bodyweightKg);
            }
        }

        const hasPreviousPeriodData = baselineKg != null;
        const changeKg = averageKg != null && baselineKg != null
            ? round2(averageKg - baselineKg)
            : null;
        const towardGoal = changeKg != null
            ? isWeightChangeTowardGoal(changeKg, user.goal, frequencyWeeks)
            : null;

        const weightWindowLabel = scheduledPeriod?.label ?? periodLabel;
        const advice = buildWeightAdvice(changeKg, towardGoal, user.goal, weightWindowLabel, hasPreviousPeriodData);
        weightSummary = {
            currentKg: averageKg,
            baselineKg,
            changeKg,
            entries: periodRows.entries,
            towardGoal,
            targetKg: user.targetWeightKg,
            hasPreviousCheckIn: hasPreviousPeriodData,
            windowLabel: weightWindowLabel,
            message: advice.message,
            detail: advice.detail,
        };
    }

    const metricRows = await getDailyMetricsInRange(userId, startDateKey, endDateKey);
    const lifestyle = summarizeLifestylePeriod(metricRows, metricTargets, periodDays);

    const toLifestyleBlock = (
        key: LifestyleMetricKey
    ): CheckInLifestyleMetricSummary | null => {
        if (!isLifestyleShownOnDashboard(hiddenGoals, key)) return null;
        const summary = lifestyle[key];
        const enoughData = hasEnoughLifestyleAssessmentData(summary.loggedDays, summary.expectedDays);
        const verdict = resolveLifestyleVerdict(key, summary, enoughData);
        const copy = buildLifestyleCheckInCopy(key, summary, verdict);
        return {
            average: summary.average,
            target: summary.target,
            daysLogged: summary.loggedDays,
            expectedDays: summary.expectedDays,
            loggingRatePercent: summary.loggingRatePercent,
            onTargetDays: summary.onTargetDays,
            onTargetPercent: summary.adherencePercent,
            metGoal: lifestyleMetFlag(verdict),
            enoughData,
            verdict,
            message: copy.message,
            detail: copy.detail,
        };
    };

    const caloriesSummary = toLifestyleBlock("calories");
    const stepsSummary = toLifestyleBlock("steps");
    const sleepSummary = toLifestyleBlock("sleep");

    const [completedRows, prRows] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS "count"
            FROM "workout_logs"
            WHERE "userId" = ${userId}
                AND "status" = 'COMPLETED'
                AND "loggedAt" >= ${effectiveStart}
                AND "loggedAt" <= ${end}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS "count"
            FROM "log_sets" ls
            INNER JOIN "workout_logs" wl ON wl."id" = ls."workoutLogId"
            WHERE wl."userId" = ${userId}
                AND wl."status" = 'COMPLETED'
                AND ls."isPR" = true
                AND wl."loggedAt" >= ${effectiveStart}
                AND wl."loggedAt" <= ${end}
        `,
    ]);
    const completed = Number(completedRows[0]?.count ?? 0);
    const prCount = Number(prRows[0]?.count ?? 0);
    const periodWeeks = Math.max(1, periodDays / 7);
    const targetWorkouts = Math.max(0, Math.round(workoutsPerWeek * periodWeeks));
    const skipped = Math.max(0, targetWorkouts - completed);
    const workoutAdvice = buildWorkoutAdvice(completed, targetWorkouts);
    const overall = buildOverallOverview({
        weight: weightSummary,
        calories: caloriesSummary,
        steps: stepsSummary,
        sleep: sleepSummary,
        workouts: {
            completed,
            skipped,
            target: targetWorkouts,
            completionPercent: workoutAdvice.completionPercent,
            prCount,
            message: workoutAdvice.message,
            detail: workoutAdvice.detail,
        },
        isWeightHidden,
    });

    return {
        periodDays,
        periodStartDateKey: startDateKey,
        periodEndDateKey: endDateKey,
        periodLabel,
        frequencyWeeks,
        weight: weightSummary,
        calories: caloriesSummary,
        steps: stepsSummary,
        sleep: sleepSummary,
        workouts: {
            completed,
            skipped,
            target: targetWorkouts,
            completionPercent: workoutAdvice.completionPercent,
            prCount,
            message: workoutAdvice.message,
            detail: workoutAdvice.detail,
        },
        ...overall,
    };
}
