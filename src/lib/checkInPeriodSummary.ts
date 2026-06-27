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
    overallMessage: string;
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

function caloriesMetGoal(average: number, target: number, goal: string | null | undefined): boolean {
    if (goal === "LOSE_WEIGHT") return average <= target;
    if (goal === "GAIN_MUSCLE" || goal === "STRENGTH") return average >= target * 0.95;
    return average >= target * 0.9 && average <= target * 1.1;
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
            message: "First check-in baseline",
            detail: `Keep logging your weight ${weightWindowLabel} — next check-in will compare against this period.`,
        };
    }

    if (changeKg === null) {
        return {
            message: "No weight data yet",
            detail: `Log your weight a few times ${weightWindowLabel} so we can compare against your last check-in.`,
        };
    }

    const isBulking = goal === "GAIN_MUSCLE" || goal === "STRENGTH";
    const isCutting = goal === "LOSE_WEIGHT";
    const isMaintenance = !isBulking && !isCutting;

    if (towardGoal === true) {
        if (Math.abs(changeKg) < 0.15) {
            return {
                message: isMaintenance ? "Holding steady" : "Minimal change",
                detail: isMaintenance
                    ? "Your average stayed close to last check-in — exactly what you want on maintenance."
                    : isBulking
                        ? "Weight barely moved since last check-in. A small bump in calories can help if you want more gain."
                        : "Weight barely moved since last check-in. Small tweaks to intake may help if you want a steadier cut.",
            };
        }
        if (isBulking) {
            return {
                message: "Gradual gain on track",
                detail: `Up ${Math.abs(changeKg).toFixed(1)} kg since last check-in — a steady bulk pace. Keep protein high and training consistent.`,
            };
        }
        if (isCutting) {
            return {
                message: "Gradual loss on track",
                detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in — a sustainable cut pace. Keep logging and protect recovery.`,
            };
        }
        return {
            message: "Staying on target",
            detail: `Your average stayed close to last check-in (${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg). Solid maintenance work.`,
        };
    }

    if (towardGoal === false) {
        if (isBulking) {
            return changeKg < 0
                ? {
                    message: "Weight dipped",
                    detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in while bulking. Add calories or reduce cardio to get back on track.`,
                }
                : {
                    message: "Gain came too fast",
                    detail: `Up ${changeKg.toFixed(1)} kg since last check-in — faster than ideal for a lean bulk. Ease calories slightly if body fat is climbing.`,
                };
        }
        if (isCutting) {
            return changeKg > 0
                ? {
                    message: "Weight crept up",
                    detail: `Up ${changeKg.toFixed(1)} kg since last check-in while cutting. Review portions and daily steps.`,
                }
                : {
                    message: "Loss came too fast",
                    detail: `Down ${Math.abs(changeKg).toFixed(1)} kg since last check-in — faster than ideal. Eat a little more to protect muscle and energy.`,
                };
        }
        return {
            message: "Bigger swing than planned",
            detail: `${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg since last check-in — larger than ideal for maintenance. Review intake and activity.`,
        };
    }

    return {
        message: changeKg === 0 ? "No change" : changeKg > 0 ? "Trending up" : "Trending down",
        detail: `${changeKg > 0 ? "+" : ""}${changeKg.toFixed(1)} kg since last check-in.`,
    };
}

function buildCaloriesAdvice(average: number | null, target: number | null, metGoal: boolean | null, goal: string | null | undefined): { message: string; detail: string } {
    if (average === null || target === null) {
        return {
            message: average === null ? "No calorie logs" : "No calorie target set",
            detail: average === null
                ? "Log calories on the dashboard when you can — even a few days helps."
                : "Ask your coach to set a calorie target if you want this tracked.",
        };
    }

    if (metGoal) {
        return {
            message: "Calories on target",
            detail: goal === "LOSE_WEIGHT"
                ? "Average intake lined up with your cut. Keep portions similar next week."
                : "You hit your calorie target on average. Solid fuel for training.",
        };
    }

    if (average < target) {
        return {
            message: "Under target on average",
            detail: goal === "GAIN_MUSCLE" || goal === "STRENGTH"
                ? "Try adding a snack or a bigger meal on training days next week."
                : "A bit under target — fine for a cut, just don't drop too fast.",
        };
    }

    return {
        message: "Over target on average",
        detail: goal === "LOSE_WEIGHT"
            ? "Calories ran high this period. Trim one snack or drink and see how next week goes."
            : "Slightly above target — not a disaster, just tighten up if you want to lean out.",
    };
}

function buildStepsAdvice(average: number | null, target: number | null, metGoal: boolean | null): { message: string; detail: string } {
    if (average === null || target === null) {
        return {
            message: average === null ? "No step logs" : "No step target set",
            detail: average === null
                ? "Log steps on the dashboard when you can — consistency matters more than perfection."
                : "Set a step target with your coach if you want this tracked.",
        };
    }

    if (metGoal) {
        return {
            message: "Steps looking good",
            detail: "You hit your step goal on average. Keep the daily movement up.",
        };
    }

    const gap = target - average;
    return {
        message: "Below step target",
        detail: gap > 3000
            ? "Steps were well short — try a 10–15 min walk after one meal each day."
            : "Close to target. One extra walk per day usually closes the gap.",
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
            detail: `You completed every planned workout this period (${completed}/${target} — ${percent}%).`,
        };
    }

    if (percent >= 90) {
        return {
            completionPercent: percent,
            message: "Excellent consistency",
            detail: `You stayed on track and only missed very little, if anything (${sessionLabel} — ${percent}%).`,
        };
    }

    if (percent >= 75) {
        return {
            completionPercent: percent,
            message: "Good consistency",
            detail: `Overall a solid period, but there's still room for improvement (${sessionLabel} — ${percent}%).`,
        };
    }

    if (percent >= 50) {
        return {
            completionPercent: percent,
            message: "Moderate consistency",
            detail: `You completed over half of your planned workouts, but aim to be more consistent next period (${sessionLabel} — ${percent}%).`,
        };
    }

    if (percent >= 25) {
        return {
            completionPercent: percent,
            message: "Low consistency",
            detail: `You missed most of your planned workouts. Try to identify what got in the way and improve next period (${sessionLabel} — ${percent}%).`,
        };
    }

    if (percent >= 1) {
        return {
            completionPercent: percent,
            message: "Very low consistency",
            detail: `Training was minimal this period. Focus on rebuilding your routine one session at a time (${sessionLabel} — ${percent}%).`,
        };
    }

    return {
        completionPercent: percent,
        message: "No workouts completed",
        detail: `You didn't complete any planned workouts this period (${completed}/${target} — 0%). Prioritise getting back into your routine next week.`,
    };
}

function buildOverallMessage(parts: { good: number; bad: number; neutral: number }): string {
    if (parts.bad === 0 && parts.good >= 2) {
        return "Strong period overall. Keep the same habits rolling into next week.";
    }
    if (parts.bad >= 2) {
        return "A few things slipped this period. Pick one habit to fix first — usually steps or meal prep.";
    }
    if (parts.good >= 1 && parts.bad === 1) {
        return "Mixed period — some wins, some gaps. Focus on the one area that flagged red.";
    }
    return "Decent baseline. Log a bit more daily and it'll be easier to spot what to adjust.";
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
    let endDateStr = referenceDate;

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

    let caloriesSummary: CheckInPeriodSummary["calories"] = null;
    if (!hiddenGoals.includes("calories") && metricTargets.targetCalories) {
        const rows = await prisma.$queryRaw<Array<{ averageCalories: number | null; entries: bigint }>>`
            SELECT AVG("calories")::float AS "averageCalories", COUNT(*)::bigint AS "entries"
            FROM "daily_metric_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= ${startDateStr}::date
                AND "loggedDate" <= ${endDateStr}::date
                AND "calories" IS NOT NULL
        `;
        const average = rows[0]?.averageCalories != null ? Math.round(rows[0].averageCalories) : null;
        const target = metricTargets.targetCalories;
        const metGoal = average != null ? caloriesMetGoal(average, target, user.goal) : null;
        const advice = buildCaloriesAdvice(average, target, metGoal, user.goal);
        caloriesSummary = {
            average,
            target,
            daysLogged: Number(rows[0]?.entries ?? 0),
            metGoal,
            message: advice.message,
            detail: advice.detail,
        };
    }

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
        const advice = buildStepsAdvice(average, target, metGoal);
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

    let good = 0;
    let bad = 0;
    let neutral = 0;
    const tally = (met: boolean | null) => {
        if (met === true) good += 1;
        else if (met === false) bad += 1;
        else neutral += 1;
    };
    if (weightSummary) tally(weightSummary.towardGoal);
    if (caloriesSummary) tally(caloriesSummary.metGoal);
    if (stepsSummary) tally(stepsSummary.metGoal);
    const workoutPercent = workoutAdvice.completionPercent;
    tally(workoutPercent >= 100 ? true : workoutPercent >= 75 ? null : false);

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
        overallMessage: buildOverallMessage({ good, bad, neutral }),
    };
}
