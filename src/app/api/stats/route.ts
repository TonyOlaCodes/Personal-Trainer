import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval, startOfMonth, startOfYear, addDays, endOfDay } from "date-fns";
import { ensureDailyMetricsTable, getDailyMetricTargets } from "@/lib/dailyMetrics";
import { calculateOneRM } from "@/lib/utils";
import { ensureBodyweightTable } from "@/lib/bodyweight";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            include: {
                checkIns: { orderBy: { createdAt: "asc" } }
            }
        });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        await ensureDailyMetricsTable();

    // Fetch completed workout logs
    const logs = await prisma.workoutLog.findMany({
        where: { userId: user.id, status: "COMPLETED" },
        include: {
            workout: { select: { name: true } },
            sets: {
                include: {
                    exercise: { select: { name: true, muscleGroup: true } }
                }
            }
        },
        orderBy: { loggedAt: "asc" }
    }) as any[];

    // Aggregation containers
    const exerciseHistory: Record<string, any[]> = {};
    const muscleVolume: Record<string, number> = {};
    
    // Volume Aggregations
    const dailyVolumeMap: Record<string, number> = {};
    const weeklyVolumeMap: Record<string, { label: string; volume: number }> = {};
    const monthlyVolumeMap: Record<string, number> = {};
    const yearlyVolumeMap: Record<string, number> = {};

    const exercisePRs: Record<string, { weight: number; reps: number; date: string; prevWeight: number }> = {};

    const big3: Record<string, { weight: number; reps: number; date: string; change: number }> = {
        "Bench Press": { weight: 0, reps: 0, date: "", change: 0 },
        "Squat": { weight: 0, reps: 0, date: "", change: 0 },
        "Deadlift": { weight: 0, reps: 0, date: "", change: 0 }
    };

    const sbdByDate: Record<string, { date: string; dateKey: string; squat: number | null; bench: number | null; deadlift: number | null; squat1RM: number | null; bench1RM: number | null; deadlift1RM: number | null }> = {};

    const now = new Date();
    const thisWeekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    const lastWeekRange = { start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) };

    // Week-to-date: compare Mon→today this week with the same Mon→day last week
    const dayIndexInWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
    const thisWeekWtdRange = { start: thisWeekRange.start, end: endOfDay(now) };
    const lastWeekWtdRange = {
        start: lastWeekRange.start,
        end: endOfDay(addDays(lastWeekRange.start, dayIndexInWeek)),
    };
    const volumeComparisonPeriod = `${format(thisWeekRange.start, "EEE")}–${format(now, "EEE")}`;

    let workoutsThisWeek = 0;
    let workoutsLastWeek = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumeLastWeek = 0;

    let lastWorkoutSummary: any = null;

    logs.forEach(log => {
        const dateStr = format(log.loggedAt, "MMM dd");
        const dayKey = format(log.loggedAt, "yyyy-MM-dd");
        const weekStartKey = format(startOfWeek(log.loggedAt, { weekStartsOn: 1 }), "yyyy-MM-dd");
        const weekKey = format(startOfWeek(log.loggedAt, { weekStartsOn: 1 }), "MMM dd");
        const monthKey = format(startOfMonth(log.loggedAt), "MMM yyyy");
        const yearKey = format(startOfYear(log.loggedAt), "yyyy");

        const isThisWeek = isWithinInterval(log.loggedAt, thisWeekRange);
        const isLastWeek = isWithinInterval(log.loggedAt, lastWeekRange);

        if (isThisWeek) workoutsThisWeek++;
        if (isLastWeek) workoutsLastWeek++;

        let sessionVolume = 0;
        let sessionSets = 0;
        const sessionExercises: string[] = [];

        log.sets.forEach((set: any) => {
            if (!set.exercise || !set.isCompleted) return;
            const exName = set.exercise.name;
            const mg = set.exercise.muscleGroup || "Other";
            const sWeight = set.weightKg || 0;
            const sReps = set.reps || 0;
            const sVol = sWeight * sReps;
            sessionSets++;
            sessionVolume += sVol;

            if (!sessionExercises.includes(exName)) sessionExercises.push(exName);

            // Volume tracking
            muscleVolume[mg] = (muscleVolume[mg] || 0) + sVol;
            
            dailyVolumeMap[dayKey] = (dailyVolumeMap[dayKey] || 0) + sVol;
            if (!weeklyVolumeMap[weekStartKey]) {
                weeklyVolumeMap[weekStartKey] = { label: weekKey, volume: 0 };
            }
            weeklyVolumeMap[weekStartKey].volume += sVol;
            monthlyVolumeMap[monthKey] = (monthlyVolumeMap[monthKey] || 0) + sVol;
            yearlyVolumeMap[yearKey] = (yearlyVolumeMap[yearKey] || 0) + sVol;

            if (isWithinInterval(log.loggedAt, thisWeekWtdRange)) totalVolumeThisWeek += sVol;
            if (isWithinInterval(log.loggedAt, lastWeekWtdRange)) totalVolumeLastWeek += sVol;

            // Big 3 & PR logic (remaining unchanged for brevity but included in output)
            const normalizedEx = exName.toLowerCase();
            let big3Key = "";
            if (normalizedEx.includes("bench press")) big3Key = "Bench Press";
            else if (normalizedEx.includes("squat")) big3Key = "Squat";
            else if (normalizedEx.includes("deadlift")) big3Key = "Deadlift";

            if (big3Key && sWeight > 0) {
                if (sWeight > (big3[big3Key].weight || 0)) {
                    const prevWeight = big3[big3Key].weight || 0;
                    big3[big3Key] = {
                        weight: sWeight, reps: sReps, date: dateStr,
                        change: prevWeight > 0 ? sWeight - prevWeight : 0
                    };
                }
                if (!sbdByDate[dateStr]) sbdByDate[dateStr] = { 
                    date: dateStr, dateKey: dayKey, 
                    squat: null, bench: null, deadlift: null,
                    squat1RM: null, bench1RM: null, deadlift1RM: null
                };
                const fieldKey    = big3Key === "Squat" ? "squat"    : big3Key === "Bench Press" ? "bench"    : "deadlift";
                const fieldKey1RM = big3Key === "Squat" ? "squat1RM" : big3Key === "Bench Press" ? "bench1RM" : "deadlift1RM";
                
                const curVal = sbdByDate[dateStr][fieldKey as "squat"|"bench"|"deadlift"] ?? 0;
                if (sWeight > curVal) {
                    sbdByDate[dateStr][fieldKey as "squat"|"bench"|"deadlift"] = sWeight;
                }
                
                const cur1RMVal = sbdByDate[dateStr][fieldKey1RM as "squat1RM"|"bench1RM"|"deadlift1RM"] ?? 0;
                const set1RM = calculateOneRM(sWeight, sReps);
                if (set1RM > cur1RMVal) {
                    sbdByDate[dateStr][fieldKey1RM as "squat1RM"|"bench1RM"|"deadlift1RM"] = set1RM;
                }
            }

            if (sWeight > 0) {
                // PR is now based on absolute MAX weight, not estimated 1RM
                if (!exercisePRs[exName] || sWeight > exercisePRs[exName].weight) {
                    exercisePRs[exName] = { 
                        weight: sWeight, 
                        reps: sReps, 
                        date: dateStr, 
                        prevWeight: exercisePRs[exName]?.weight || 0 
                    };
                }
            }

            if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
            const existingSession = exerciseHistory[exName].find((h: any) => h.date === dateStr);
            const currentOneRM = calculateOneRM(sWeight, sReps);

            if (existingSession) {
                if (sWeight > existingSession.weight) {
                    existingSession.weight = sWeight;
                    existingSession.reps = sReps;
                }
                if (currentOneRM > (existingSession.oneRM || 0)) {
                    existingSession.oneRM = currentOneRM;
                }
                existingSession.volume += sVol;
            } else {
                exerciseHistory[exName].push({
                    date: dateStr,
                    weight: sWeight,
                    reps: sReps,
                    volume: sVol,
                    oneRM: currentOneRM,
                });
            }
        });

        lastWorkoutSummary = {
            id: log.id,
            name: log.workout?.name || "Workout",
            date: format(log.loggedAt, "EEE, MMM dd"),
            duration: log.duration || null,
            totalSets: sessionSets,
            totalVolume: Math.round(sessionVolume),
            exercises: sessionExercises.slice(0, 5),
            feeling: log.feeling
        };
    });

    await ensureBodyweightTable();
    const dbBodyweightLogs = await prisma.$queryRaw<Array<{ date: string; dateKey: string; weight: number }>>`
        SELECT
            to_char("loggedDate", 'Mon DD') AS "date",
            "loggedDate"::text AS "dateKey",
            "weightKg" AS "weight"
        FROM "bodyweight_logs"
        WHERE "userId" = ${user.id}
        ORDER BY "loggedDate" ASC
    ` || [];

    const combinedWeightMap = new Map<string, { date: string; dateKey: string; weight: number }>();

    // 1. Weekly check-ins
    (user.checkIns ?? []).forEach((c: any) => {
        if (c.bodyweightKg) {
            const cDate = c.createdAt ?? new Date();
            const dateKey = cDate.toISOString().slice(0, 10);
            const dateStr = format(cDate, "MMM dd");
            combinedWeightMap.set(dateKey, { date: dateStr, dateKey, weight: c.bodyweightKg });
        }
    });

    // 2. Bodyweight logs
    (dbBodyweightLogs ?? []).forEach((row: any) => {
        if (row.weight) {
            const dateKey = row.dateKey ? row.dateKey.slice(0, 10) : "";
            if (dateKey) {
                combinedWeightMap.set(dateKey, {
                    date: row.date,
                    dateKey: dateKey,
                    weight: row.weight
                });
            }
        }
    });

    // 3. Fallback: If no history exists at all, use user.weightKg at user.createdAt (so there's at least one data point)
    if (combinedWeightMap.size === 0 && user.weightKg) {
        const uDate = user.createdAt ?? new Date();
        const dateKey = uDate.toISOString().slice(0, 10);
        const dateStr = format(uDate, "MMM dd");
        combinedWeightMap.set(dateKey, { date: dateStr, dateKey, weight: user.weightKg });
    }

    const bodyweightHistory = Array.from(combinedWeightMap.values())
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const currentWeight = bodyweightHistory[bodyweightHistory.length - 1]?.weight || user.weightKg || 0;
    const startWeight = bodyweightHistory[0]?.weight || user.weightKg || 0;

    const twoWeeksAgo = subWeeks(now, 2);
    const recentBwLogs = bodyweightHistory.filter(h => new Date(h.dateKey) >= twoWeeksAgo);
    const weightChangeWeek = recentBwLogs.length > 1
        ? (recentBwLogs[recentBwLogs.length - 1]?.weight || currentWeight) - (recentBwLogs[0]?.weight || currentWeight)
        : 0;

    const [dailyMetricRows, dailyMetricTargets] = await Promise.all([
        prisma.$queryRaw<Array<{
            date: string;
            dateKey: string;
            calories: number | null;
            steps: number | null;
            sleepHours: number | null;
        }>>`
            SELECT
                to_char("loggedDate", 'Mon DD') AS "date",
                "loggedDate"::text AS "dateKey",
                "calories",
                "steps",
                "sleepHours"
            FROM "daily_metric_logs"
            WHERE "userId" = ${user.id}
            ORDER BY "loggedDate" ASC
        `,
        getDailyMetricTargets(user.id),
    ]);

    const currentWeekMetricRows = dailyMetricRows.filter((row) =>
        isWithinInterval(new Date(row.dateKey), thisWeekRange)
    );
    const previousWeekMetricRows = dailyMetricRows.filter((row) =>
        isWithinInterval(new Date(row.dateKey), lastWeekRange)
    );
    const averageMetric = (rows: typeof dailyMetricRows, key: "calories" | "steps" | "sleepHours") => {
        const values = rows
            .map((row) => row[key])
            .filter((value): value is number => typeof value === "number");
        if (values.length === 0) return null;
        return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    };
    const latestMetricWith = (key: "calories" | "steps" | "sleepHours") =>
        [...dailyMetricRows].reverse().find((row) => typeof row[key] === "number") ?? null;

    const dailyMetrics = {
        calories: {
            current: latestMetricWith("calories")?.calories ?? null,
            target: dailyMetricTargets.targetCalories,
            weeklyAverage: averageMetric(currentWeekMetricRows, "calories"),
            previousWeeklyAverage: averageMetric(previousWeekMetricRows, "calories"),
            history: dailyMetricRows.filter((row) => row.calories !== null).map((row) => ({
                date: row.date,
                dateKey: row.dateKey,
                value: row.calories,
            })),
        },
        steps: {
            current: latestMetricWith("steps")?.steps ?? null,
            target: dailyMetricTargets.targetSteps,
            weeklyAverage: averageMetric(currentWeekMetricRows, "steps"),
            previousWeeklyAverage: averageMetric(previousWeekMetricRows, "steps"),
            history: dailyMetricRows.filter((row) => row.steps !== null).map((row) => ({
                date: row.date,
                dateKey: row.dateKey,
                value: row.steps,
            })),
        },
        sleep: {
            current: latestMetricWith("sleepHours")?.sleepHours ?? null,
            target: dailyMetricTargets.targetSleepHours,
            weeklyAverage: averageMetric(currentWeekMetricRows, "sleepHours"),
            previousWeeklyAverage: averageMetric(previousWeekMetricRows, "sleepHours"),
            history: dailyMetricRows.filter((row) => row.sleepHours !== null).map((row) => ({
                date: row.date,
                dateKey: row.dateKey,
                value: row.sleepHours,
            })),
        },
    };

    const prList = Object.entries(exercisePRs)
        .filter(([, pr]) => pr.weight > 0)
        .map(([name, pr]) => ({
            name, weight: pr.weight, reps: pr.reps, date: pr.date,
            improvement: pr.prevWeight > 0 ? Math.round(((pr.weight - pr.prevWeight) / pr.prevWeight) * 100) : 0
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);

    const exerciseFrequency = Object.entries(exerciseHistory)
        .map(([name, history]) => ({ name, sessions: history.length }))
        .sort((a, b) => b.sessions - a.sessions);

    const topExercises = exerciseFrequency.slice(0, 6).map(e => e.name);
    const volumeChangeKg = Math.round(totalVolumeThisWeek - totalVolumeLastWeek);
    const volumeChange = totalVolumeLastWeek > 0
        ? Math.round((volumeChangeKg / totalVolumeLastWeek) * 100)
        : null;

    const weeklySummary = {
        workouts: workoutsThisWeek,
        target: user.trainingDaysPerWeek || 4,
        totalVolume: Math.round(totalVolumeThisWeek),
        lastWeekVolume: Math.round(totalVolumeLastWeek),
        volumeComparisonPeriod,
        volumeComparisonDays: dayIndexInWeek + 1,
        volumeChange,
        volumeChangeKg,
        weightChange: Math.round(weightChangeWeek * 10) / 10,
        currentWeight,
        prsThisWeek: prList.filter(pr => pr.improvement > 0).length
    };

    const sbdTimeline = Object.values(sbdByDate).sort((a, b) => a.dateKey!.localeCompare(b.dateKey!));
    
    let peakS = 0, peakB = 0, peakD = 0;
    let peakS1RM = 0, peakB1RM = 0, peakD1RM = 0;

    const sbdTimelineProgressive = sbdTimeline.map(row => {
        if (row.squat !== null && row.squat > peakS) peakS = row.squat;
        if (row.bench !== null && row.bench > peakB) peakB = row.bench;
        if (row.deadlift !== null && row.deadlift > peakD) peakD = row.deadlift;

        if (row.squat1RM !== null && row.squat1RM > peakS1RM) peakS1RM = row.squat1RM;
        if (row.bench1RM !== null && row.bench1RM > peakB1RM) peakB1RM = row.bench1RM;
        if (row.deadlift1RM !== null && row.deadlift1RM > peakD1RM) peakD1RM = row.deadlift1RM;

        return {
            date: row.date,
            squat: peakS || null,
            bench: peakB || null,
            deadlift: peakD || null,
            squat1RM: peakS1RM || null,
            bench1RM: peakB1RM || null,
            deadlift1RM: peakD1RM || null,
        };
    });

    const volumes = {
        daily: Object.entries(dailyVolumeMap).map(([label, volume]) => ({ label, volume: Math.round(volume as number) })).slice(-30),
        weekly: Object.entries(weeklyVolumeMap)
            .map(([weekStart, entry]) => ({
                label: entry.label,
                weekStart,
                volume: Math.round(entry.volume),
            }))
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
            .slice(-12),
        monthly: Object.entries(monthlyVolumeMap).map(([label, volume]) => ({ label, volume: Math.round(volume as number) })).slice(-12),
        yearly: Object.entries(yearlyVolumeMap).map(([label, volume]) => ({ label, volume: Math.round(volume as number) }))
    };

        return NextResponse.json({
            totalWorkouts: logs.length,
            consistency: { thisWeek: workoutsThisWeek, lastWeek: workoutsLastWeek, target: user.trainingDaysPerWeek || 4 },
            bodyweight: {
                current: currentWeight, target: user.targetWeightKg || null, goal: user.goal || null,
                changeWeek: weightChangeWeek, totalChange: currentWeight - startWeight, history: bodyweightHistory
            },
            dailyMetrics,
            big3,
            sbdTimeline: sbdTimelineProgressive,
            muscleVolume,
            exerciseHistory,
            prList,
            topExercises,
            lastWorkout: lastWorkoutSummary,
            weeklySummary,
            volumes
        });
    } catch (error) {
        console.error("Error in GET /api/stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
