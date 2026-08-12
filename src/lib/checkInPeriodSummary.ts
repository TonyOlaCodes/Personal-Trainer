import { prisma } from "@/lib/prisma";
import { addDaysToDateStr, ensureBodyweightTable, getBodyweightAverageInRange } from "@/lib/bodyweight";
import { ensureDailyMetricsTable, getDailyMetricTargets } from "@/lib/dailyMetrics";
import { getUserCheckInSchedule, type CheckInSchedule } from "@/lib/checkInSchedule";
import { getWorkoutsTargetFromUserPlan } from "@/lib/planTrainingTarget";
import { startOfWeek, endOfWeek } from "date-fns";

export type CheckInPeriodSummary = {
    periodDays: number;
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
    calories: {
        average: number | null;
        target: number | null;
        daysLogged: number;
        metGoal: boolean | null;
        message: string;
        detail: string;
    } | null;
    steps: {
        average: number | null;
        target: number | null;
        daysLogged: number;
        metGoal: boolean | null;
        message: string;
        detail: string;
    } | null;
    workouts: {
        completed: number;
        skipped: number;
        target: number;
        completionPercent: number;
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

function getCheckInBodyweightWindow(
    periodEndDate: string,
    priorCheckInDate: string | null,
    accountCreatedAt: Date
): { startDateStr: string; endDateStr: string } {
    const endDateStr = periodEndDate;
    const accountStart = accountCreatedAt.toISOString().slice(0, 10);
    const startDateStr = priorCheckInDate ? addDaysToDateStr(priorCheckInDate, 1) : accountStart;

    return {
        startDateStr: startDateStr > endDateStr ? endDateStr : startDateStr,
        endDateStr,
    };
}

async function findPreviousCheckIn(userId: string, referenceDate: string) {
    return prisma.checkIn.findFirst({
        where: {
            userId,
            createdAt: { lt: new Date(`${referenceDate}T00:00:00.000`) },
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
    const priorCheckInDate = previousCheckIn?.createdAt.toISOString().slice(0, 10) ?? null;
    const window = getCheckInBodyweightWindow(referenceDate, priorCheckInDate, accountCreatedAt);
    const { averageWeightKg, entries } = await getBodyweightAverageInRange(
        userId,
        window.startDateStr,
        window.endDateStr
    );

    return {
        averageWeightKg,
        entries,
        startDateStr: window.startDateStr,
        endDateStr: window.endDateStr,
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

function buildStepsAdvice(average: number | null, target: number | null, metGoal: boolean | null, daysLogged: number): { message: string; detail: string } {
    if (average === null) {
        return {
            message: "Not enough step data",
            detail: "There is not enough step data logged this period to assess daily movement.",
        };
    }

    if (target === null) {
        return {
            message: "No step target set",
            detail: "Steps were logged, but no step target is set. Your coach can add one if you want this tracked.",
        };
    }

    if (metGoal) {
        return {
            message: "Steps on target",
            detail: `You averaged ${average.toLocaleString()} steps per day across ${daysLogged} logged day${daysLogged === 1 ? "" : "s"}.`,
        };
    }

    return {
        message: "Below step target",
        detail: `You averaged ${average.toLocaleString()} steps per day versus a target of ${target.toLocaleString()}. Improving daily movement consistency may help.`,
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

function buildOverallOverview(input: {
    weight: CheckInPeriodSummary["weight"];
    steps: CheckInPeriodSummary["steps"];
    workouts: CheckInPeriodSummary["workouts"];
    isWeightHidden: boolean;
    stepsTracked: boolean;
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

    if (input.stepsTracked) {
        if (!input.steps || input.steps.average == null) {
            unassessed.push("Daily steps");
        } else if (input.steps.metGoal) {
            progress.push("Daily step average met your target.");
        } else if (input.steps.metGoal === false) {
            attention.push("Daily step average was below target.");
        }
    }

    if (input.workouts.completionPercent >= 80) {
        progress.push("Training consistency was strong this period.");
    } else if (input.workouts.completionPercent < 50) {
        attention.push("Several planned workouts were missed this period.");
    }

    if (attention.some((line) => line.includes("workout")) || input.workouts.completionPercent < 80) {
        nextSteps.push("Aim to complete your scheduled workouts where possible.");
    }
    if (unassessed.length > 0) {
        nextSteps.push("Log missing metrics so the next overview can be more complete.");
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

function getCheckInPeriodBounds(
    referenceDate: string,
    frequencyWeeks: number,
    accountCreatedAt: Date
): { startDateStr: string; endDateStr: string; effectiveStart: Date; end: Date } {
    const periodDays = getCheckInPeriodDays({ frequencyWeeks });
    const end = new Date(`${referenceDate}T23:59:59.999`);
    const referenceMidday = new Date(`${referenceDate}T12:00:00`);

    let periodStart: Date;
    const endDateStr = referenceDate;

    if (frequencyWeeks <= 1) {
        periodStart = startOfWeek(referenceMidday, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(referenceMidday, { weekStartsOn: 1 });
        if (weekEnd.getTime() < end.getTime()) {
            end.setTime(weekEnd.getTime());
            end.setHours(23, 59, 59, 999);
        }
    } else {
        periodStart = new Date(referenceMidday);
        periodStart.setDate(periodStart.getDate() - periodDays);
        periodStart.setHours(0, 0, 0, 0);
    }

    const accountStart = new Date(accountCreatedAt);
    accountStart.setHours(0, 0, 0, 0);
    const effectiveStart = accountStart > periodStart ? accountStart : periodStart;
    const startDateStr = effectiveStart.toISOString().slice(0, 10);

    return { startDateStr, endDateStr, effectiveStart, end };
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
    const periodDays = getCheckInPeriodDays(schedule);
    const periodLabel = getCheckInPeriodLabel(frequencyWeeks);

    const { startDateStr, endDateStr, effectiveStart, end } = getCheckInPeriodBounds(
        referenceDate,
        frequencyWeeks,
        user.createdAt
    );

    const previousCheckIn = await findPreviousCheckIn(userId, referenceDate);
    const hasPreviousCheckIn = previousCheckIn != null;
    const priorCheckInDate = previousCheckIn?.createdAt.toISOString().slice(0, 10) ?? null;

    let weightSummary: CheckInPeriodSummary["weight"] = null;
    if (!isWeightHidden) {
        const currentWindow = getCheckInBodyweightWindow(referenceDate, priorCheckInDate, user.createdAt);
        const periodRows = await getBodyweightAverageInRange(
            userId,
            currentWindow.startDateStr,
            currentWindow.endDateStr
        );

        const averageKg = periodRows.averageWeightKg != null ? round2(periodRows.averageWeightKg) : null;

        let baselineKg: number | null = null;
        if (hasPreviousCheckIn && previousCheckIn) {
            const priorPriorCheckIn = await prisma.checkIn.findFirst({
                where: {
                    userId,
                    createdAt: { lt: previousCheckIn.createdAt },
                },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            });
            const priorPriorDate = priorPriorCheckIn?.createdAt.toISOString().slice(0, 10) ?? null;
            const prevWindow = getCheckInBodyweightWindow(
                previousCheckIn.createdAt.toISOString().slice(0, 10),
                priorPriorDate,
                user.createdAt
            );
            const prevPeriodRows = await getBodyweightAverageInRange(
                userId,
                prevWindow.startDateStr,
                prevWindow.endDateStr
            );

            if (prevPeriodRows.averageWeightKg != null) {
                baselineKg = round2(prevPeriodRows.averageWeightKg);
            } else if (previousCheckIn.bodyweightKg != null) {
                baselineKg = round2(previousCheckIn.bodyweightKg);
            }
        }

        const changeKg = averageKg != null && baselineKg != null && hasPreviousCheckIn
            ? round2(averageKg - baselineKg)
            : null;
        const towardGoal = changeKg != null
            ? isWeightChangeTowardGoal(changeKg, user.goal, frequencyWeeks)
            : null;

        const weightWindowLabel = hasPreviousCheckIn ? "since last check-in" : "logged so far";
        const advice = buildWeightAdvice(changeKg, towardGoal, user.goal, weightWindowLabel, hasPreviousCheckIn);
        weightSummary = {
            currentKg: averageKg,
            baselineKg,
            changeKg,
            entries: periodRows.entries,
            towardGoal,
            targetKg: user.targetWeightKg,
            hasPreviousCheckIn,
            windowLabel: weightWindowLabel,
            message: advice.message,
            detail: advice.detail,
        };
    }

    const caloriesSummary: CheckInPeriodSummary["calories"] = null;

    let stepsSummary: CheckInPeriodSummary["steps"] = null;
    if (!hiddenGoals.includes("steps") && metricTargets.targetSteps) {
        const rows = await prisma.$queryRaw<Array<{ averageSteps: number | null; entries: bigint }>>`
            SELECT AVG("steps")::float AS "averageSteps", COUNT(*)::bigint AS "entries"
            FROM "daily_metric_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= ${startDateStr}::date
                AND "loggedDate" <= ${endDateStr}::date
                AND "steps" IS NOT NULL
        `;
        const average = rows[0]?.averageSteps != null ? Math.round(rows[0].averageSteps) : null;
        const target = metricTargets.targetSteps;
        const metGoal = average != null && target != null ? average >= target : null;
        const advice = buildStepsAdvice(average, target, metGoal, Number(rows[0]?.entries ?? 0));
        stepsSummary = {
            average,
            target,
            daysLogged: Number(rows[0]?.entries ?? 0),
            metGoal,
            message: advice.message,
            detail: advice.detail,
        };
    }

    const completedRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS "count"
        FROM "workout_logs"
        WHERE "userId" = ${userId}
            AND "status" = 'COMPLETED'
            AND "loggedAt" >= ${effectiveStart}
            AND "loggedAt" <= ${end}
    `;
    const completed = Number(completedRows[0]?.count ?? 0);
    const targetWorkouts = workoutsPerWeek * frequencyWeeks;
    const skipped = Math.max(0, targetWorkouts - completed);
    const workoutAdvice = buildWorkoutAdvice(completed, targetWorkouts);
    const stepsTracked = !hiddenGoals.includes("steps");
    const overall = buildOverallOverview({
        weight: weightSummary,
        steps: stepsSummary,
        workouts: {
            completed,
            skipped,
            target: targetWorkouts,
            completionPercent: workoutAdvice.completionPercent,
            message: workoutAdvice.message,
            detail: workoutAdvice.detail,
        },
        isWeightHidden,
        stepsTracked,
    });

    return {
        periodDays,
        periodLabel,
        frequencyWeeks,
        weight: weightSummary,
        calories: caloriesSummary,
        steps: stepsSummary,
        workouts: {
            completed,
            skipped,
            target: targetWorkouts,
            completionPercent: workoutAdvice.completionPercent,
            message: workoutAdvice.message,
            detail: workoutAdvice.detail,
        },
        ...overall,
    };
}
