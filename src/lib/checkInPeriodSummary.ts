import { prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureDailyMetricsTable, getDailyMetricTargets } from "@/lib/dailyMetrics";
import { getUserCheckInSchedule, type CheckInSchedule } from "@/lib/checkInSchedule";

export type CheckInPeriodSummary = {
    periodDays: number;
    periodLabel: string;
    frequencyWeeks: number;
    weight: {
        currentKg: number | null;
        baselineKg: number | null;
        changeKg: number | null;
        entries: number;
        towardGoal: boolean | null;
        targetKg: number | null;
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

export function isWeightChangeTowardGoal(
    changeKg: number,
    goal: string | null | undefined,
    targetKg: number | null | undefined,
    startWeight: number,
    endWeight: number
): boolean {
    if (changeKg === 0) return true;

    if (targetKg != null && targetKg > 0) {
        const startDistance = Math.abs(startWeight - targetKg);
        const endDistance = Math.abs(endWeight - targetKg);
        if (endDistance < startDistance) return true;
        if (endDistance > startDistance) return false;
    }

    switch (goal) {
        case "LOSE_WEIGHT":
            return changeKg < 0;
        case "GAIN_MUSCLE":
        case "STRENGTH":
            return changeKg > 0;
        case "RECOMPOSITION":
            if (targetKg != null && targetKg > 0) {
                return Math.abs(endWeight - targetKg) <= Math.abs(startWeight - targetKg);
            }
            return changeKg < 0;
        default:
            if (targetKg != null && targetKg > 0) {
                return Math.abs(endWeight - targetKg) < Math.abs(startWeight - targetKg);
            }
            return changeKg <= 0;
    }
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
    targetKg: number | null,
    periodLabel: string
): { message: string; detail: string } {
    if (changeKg === null) {
        return {
            message: "No weight data yet",
            detail: `Log your weight a few times over ${periodLabel} so we can track the trend.`,
        };
    }

    if (towardGoal === true) {
        if (targetKg && Math.abs(changeKg) < 0.15) {
            return {
                message: "Holding steady",
                detail: "Weight barely moved — that's fine if you're close to goal. Keep logging daily.",
            };
        }
        return {
            message: "Moving the right way",
            detail: changeKg < 0
                ? "You're trending down. Stay consistent with meals and daily weigh-ins."
                : changeKg > 0
                    ? "You're trending up. Keep protein up and stay on your training plan."
                    : "You're on track versus your goal. Same approach next period.",
        };
    }

    if (towardGoal === false) {
        return {
            message: "Went the wrong direction",
            detail: changeKg > 0
                ? "Weight crept up this period. Review portions and try to hit your step target most days."
                : "Weight dropped more than planned. Make sure you're eating enough to recover and train well.",
        };
    }

    return {
        message: changeKg === 0 ? "No change" : changeKg > 0 ? "Trending up" : "Trending down",
        detail: "Set a target weight with your coach to see if this change fits your plan.",
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

function buildWorkoutAdvice(completed: number, skipped: number, target: number): { message: string; detail: string } {
    if (target <= 0) {
        return {
            message: `${completed} session${completed === 1 ? "" : "s"} logged`,
            detail: "No session target set for this period.",
        };
    }

    const rate = completed / target;
    if (rate >= 1) {
        return {
            message: "Training locked in",
            detail: skipped === 0
                ? "You hit every planned session. Keep that rhythm going."
                : "You got the work in. Same effort next period.",
        };
    }

    if (rate >= 0.75) {
        return {
            message: "Mostly consistent",
            detail: skipped > 0
                ? `You missed ${skipped} session${skipped === 1 ? "" : "s"}. Block those days on your calendar for next period.`
                : "Good week overall — push for full attendance next time.",
        };
    }

    return {
        message: "Sessions missed",
        detail: `Only ${completed} of ${target} planned sessions done. Pick your must-do days and protect them next period.`,
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
                                include: { workouts: true },
                            },
                        },
                    },
                },
                take: 1,
            },
        },
    });

    if (!user) return 4;

    let target = user.trainingDaysPerWeek ?? 4;
    const activeUserPlan = user.plans[0];
    if (activeUserPlan) {
        const weeks = activeUserPlan.plan.weeks;
        const startedAt = new Date(activeUserPlan.startedAt);
        const now = new Date();
        const diffDays = Math.max(0, Math.ceil((now.getTime() - startedAt.getTime()) / 86400000));
        let currentWeekIndex = Math.floor(diffDays / 7);
        if (currentWeekIndex >= weeks.length) currentWeekIndex = weeks.length - 1;
        const currentWeekPlan = weeks[currentWeekIndex];
        if (currentWeekPlan) target = currentWeekPlan.workouts.length;
    }

    return target;
}

export async function getCheckInPeriodSummary(
    userId: string,
    referenceDate: string,
    options?: {
        schedule?: CheckInSchedule;
        hiddenGoals?: string[];
        fallbackBodyweightKg?: number | null;
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

    const end = new Date(`${referenceDate}T12:00:00`);
    const periodStart = new Date(end);
    periodStart.setDate(periodStart.getDate() - periodDays);
    periodStart.setHours(0, 0, 0, 0);

    const accountStart = new Date(user.createdAt);
    accountStart.setHours(0, 0, 0, 0);
    const effectiveStart = accountStart > periodStart ? accountStart : periodStart;

    const endDateStr = referenceDate;
    const startDateStr = effectiveStart.toISOString().slice(0, 10);
    const baselineDate = new Date(periodStart);
    baselineDate.setHours(0, 0, 0, 0);
    const baselineDateStr = (accountStart > periodStart ? accountStart : periodStart).toISOString().slice(0, 10);

    const accountAgeMs = end.getTime() - accountStart.getTime();
    const accountYoungerThanPeriod = accountAgeMs < periodDays * 86400000;

    let weightSummary: CheckInPeriodSummary["weight"] = null;
    if (!isWeightHidden) {
        const periodRows = await prisma.$queryRaw<Array<{ averageWeightKg: number | null; entries: bigint }>>`
            SELECT AVG("weightKg")::float AS "averageWeightKg", COUNT(*)::bigint AS "entries"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
                AND "loggedDate" >= ${startDateStr}::date
                AND "loggedDate" <= ${endDateStr}::date
        `;

        const baselineRows = accountYoungerThanPeriod
            ? []
            : await prisma.$queryRaw<Array<{ weightKg: number }>>`
                SELECT "weightKg"
                FROM "bodyweight_logs"
                WHERE "userId" = ${userId}
                    AND "loggedDate" <= ${baselineDateStr}::date
                ORDER BY "loggedDate" DESC
                LIMIT 1
            `;

        const earliestRows = await prisma.$queryRaw<Array<{ weightKg: number }>>`
            SELECT "weightKg"
            FROM "bodyweight_logs"
            WHERE "userId" = ${userId}
            ORDER BY "loggedDate" ASC
            LIMIT 1
        `;

        const currentKg = periodRows[0]?.averageWeightKg != null
            ? round2(periodRows[0].averageWeightKg)
            : options?.fallbackBodyweightKg ?? null;
        const baselineKg = accountYoungerThanPeriod
            ? (earliestRows[0]?.weightKg != null ? round2(earliestRows[0].weightKg) : null)
            : baselineRows[0]?.weightKg != null
                ? round2(baselineRows[0].weightKg)
                : earliestRows[0]?.weightKg != null
                    ? round2(earliestRows[0].weightKg)
                    : null;

        const changeKg = currentKg != null && baselineKg != null ? round2(currentKg - baselineKg) : null;
        const towardGoal = changeKg != null && baselineKg != null && currentKg != null
            ? isWeightChangeTowardGoal(changeKg, user.goal, user.targetWeightKg, baselineKg, currentKg)
            : null;

        const advice = buildWeightAdvice(changeKg, towardGoal, user.targetWeightKg, periodLabel);
        weightSummary = {
            currentKg,
            baselineKg,
            changeKg,
            entries: Number(periodRows[0]?.entries ?? 0),
            towardGoal,
            targetKg: user.targetWeightKg,
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
    const workoutAdvice = buildWorkoutAdvice(completed, skipped, targetWorkouts);

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
    tally(completed >= targetWorkouts ? true : completed >= targetWorkouts * 0.75 ? null : false);

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
            message: workoutAdvice.message,
            detail: workoutAdvice.detail,
        },
        overallMessage: buildOverallMessage({ good, bad, neutral }),
    };
}
