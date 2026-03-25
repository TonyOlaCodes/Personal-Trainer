import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            checkIns: { orderBy: { createdAt: "asc" } }
        }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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
    const weeklyVolumeMap: Record<string, number> = {};
    const exercisePRs: Record<string, { weight: number; reps: number; oneRM: number; date: string; prevOneRM: number }> = {};

    const big3: Record<string, { weight: number; reps: number; oneRM: number; date: string; change: number }> = {
        "Bench Press": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 },
        "Squat": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 },
        "Deadlift": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 }
    };

    // Per-date best e1RM for each SBD lift (for the combined chart)
    const sbdByDate: Record<string, { date: string; squat: number | null; bench: number | null; deadlift: number | null }> = {};

    const now = new Date();
    const thisWeekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    const lastWeekRange = { start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) };

    let workoutsThisWeek = 0;
    let workoutsLastWeek = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumeLastWeek = 0;

    // Last workout summary
    let lastWorkoutSummary: any = null;

    logs.forEach(log => {
        const dateStr = format(log.loggedAt, "MMM dd");
        const weekKey = format(startOfWeek(log.loggedAt, { weekStartsOn: 1 }), "MMM dd");
        const isThisWeek = isWithinInterval(log.loggedAt, thisWeekRange);
        const isLastWeek = isWithinInterval(log.loggedAt, lastWeekRange);

        if (isThisWeek) workoutsThisWeek++;
        if (isLastWeek) workoutsLastWeek++;

        let sessionVolume = 0;
        let sessionSets = 0;
        const sessionExercises: string[] = [];

        log.sets.forEach((set: any) => {
            if (!set.exercise) return;
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
            weeklyVolumeMap[weekKey] = (weeklyVolumeMap[weekKey] || 0) + sVol;

            if (isThisWeek) totalVolumeThisWeek += sVol;
            if (isLastWeek) totalVolumeLastWeek += sVol;

            // Big 3 logic
            const normalizedEx = exName.toLowerCase();
            let big3Key = "";
            if (normalizedEx.includes("bench press")) big3Key = "Bench Press";
            else if (normalizedEx.includes("squat")) big3Key = "Squat";
            else if (normalizedEx.includes("deadlift")) big3Key = "Deadlift";

            if (big3Key && sWeight > 0) {
                const oneRM = Math.round(sWeight * (1 + sReps / 30));
                if (oneRM > big3[big3Key].oneRM) {
                    const prev1RM = big3[big3Key].oneRM;
                    big3[big3Key] = {
                        weight: sWeight, reps: sReps, oneRM, date: dateStr,
                        change: prev1RM > 0 ? oneRM - prev1RM : 0
                    };
                }
                // Build per-date SBD timeline
                if (!sbdByDate[dateStr]) sbdByDate[dateStr] = { date: dateStr, squat: null, bench: null, deadlift: null };
                const fieldKey = big3Key === "Squat" ? "squat" : big3Key === "Bench Press" ? "bench" : "deadlift";
                const curVal = sbdByDate[dateStr][fieldKey] ?? 0;
                if (oneRM > curVal) sbdByDate[dateStr][fieldKey] = oneRM;
            }

            // Exercise PR tracking (all exercises)
            if (sWeight > 0) {
                const oneRM = Math.round(sWeight * (1 + sReps / 30));
                if (!exercisePRs[exName] || oneRM > exercisePRs[exName].oneRM) {
                    exercisePRs[exName] = {
                        weight: sWeight, reps: sReps, oneRM, date: dateStr,
                        prevOneRM: exercisePRs[exName]?.oneRM || 0
                    };
                }
            }

            // Exercise progress history
            if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
            const existingSession = exerciseHistory[exName].find((h: any) => h.date === dateStr);
            if (existingSession) {
                if (sWeight > existingSession.weight) {
                    existingSession.weight = sWeight;
                    existingSession.reps = sReps;
                }
                existingSession.volume += sVol;
            } else {
                exerciseHistory[exName].push({ date: dateStr, weight: sWeight, reps: sReps, volume: sVol });
            }
        });

        // Track last workout
        lastWorkoutSummary = {
            name: log.workout?.name || "Workout",
            date: format(log.loggedAt, "EEE, MMM dd"),
            duration: log.duration || null,
            totalSets: sessionSets,
            totalVolume: Math.round(sessionVolume),
            exercises: sessionExercises.slice(0, 5),
            feeling: log.feeling
        };
    });

    // Bodyweight history with target line
    const bodyweightHistory = [
        ...(user.weightKg ? [{ date: format(user.createdAt, "MMM dd"), weight: user.weightKg }] : []),
        ...user.checkIns.filter((c: any) => c.bodyweightKg).map((c: any) => ({
            date: format(c.createdAt, "MMM dd"),
            weight: c.bodyweightKg
        }))
    ];

    const currentWeight = bodyweightHistory[bodyweightHistory.length - 1]?.weight || user.weightKg || 0;
    const startWeight = bodyweightHistory[0]?.weight || user.weightKg || 0;

    // Weight change this week
    const recentCheckins = user.checkIns.filter((c: any) => c.bodyweightKg && c.createdAt >= subWeeks(now, 2));
    const weightChangeWeek = recentCheckins.length > 1
        ? (recentCheckins[recentCheckins.length - 1]?.bodyweightKg || currentWeight) - (recentCheckins[0]?.bodyweightKg || currentWeight)
        : 0;

    // PR list sorted by most recent, with improvement %
    const prList = Object.entries(exercisePRs)
        .filter(([_, pr]) => pr.oneRM > 0)
        .map(([name, pr]) => ({
            name,
            weight: pr.weight,
            reps: pr.reps,
            oneRM: pr.oneRM,
            date: pr.date,
            improvement: pr.prevOneRM > 0 ? Math.round(((pr.oneRM - pr.prevOneRM) / pr.prevOneRM) * 100) : 0
        }))
        .sort((a, b) => b.oneRM - a.oneRM)
        .slice(0, 8);

    // Top exercises by frequency for strength graphs  
    const exerciseFrequency = Object.entries(exerciseHistory)
        .map(([name, history]) => ({ name, sessions: history.length }))
        .sort((a, b) => b.sessions - a.sessions);

    const topExercises = exerciseFrequency.slice(0, 6).map(e => e.name);

    // Volume change percentage
    const volumeChange = totalVolumeLastWeek > 0
        ? Math.round(((totalVolumeThisWeek - totalVolumeLastWeek) / totalVolumeLastWeek) * 100)
        : 0;

    // Weekly summary
    const weeklySummary = {
        workouts: workoutsThisWeek,
        target: user.trainingDaysPerWeek || 4,
        totalVolume: Math.round(totalVolumeThisWeek),
        volumeChange,
        weightChange: Math.round(weightChangeWeek * 10) / 10,
        currentWeight,
        prsThisWeek: prList.filter(pr => {
            // Simple heuristic: if PR date matches recent dates
            return pr.improvement > 0;
        }).length
    };

    // Merge SBD per-date into sorted timeline, carrying forward last known values
    const sbdTimeline = Object.values(sbdByDate).sort((a, b) => a.date.localeCompare(b.date));
    let lastSquat = 0, lastBench = 0, lastDeadlift = 0;
    const sbdTimelineFilled = sbdTimeline.map(row => {
        if (row.squat !== null) lastSquat = row.squat;
        if (row.bench !== null) lastBench = row.bench;
        if (row.deadlift !== null) lastDeadlift = row.deadlift;
        return {
            date: row.date,
            squat: lastSquat || null,
            bench: lastBench || null,
            deadlift: lastDeadlift || null,
        };
    });

    return NextResponse.json({
        totalWorkouts: logs.length,
        consistency: {
            thisWeek: workoutsThisWeek,
            lastWeek: workoutsLastWeek,
            target: user.trainingDaysPerWeek || 4
        },
        bodyweight: {
            current: currentWeight,
            target: user.targetWeightKg || null,
            goal: user.goal || null,
            changeWeek: weightChangeWeek,
            totalChange: currentWeight - startWeight,
            history: bodyweightHistory
        },
        big3,
        sbdTimeline: sbdTimelineFilled,
        muscleVolume,
        exerciseHistory,
        prList,
        topExercises,
        lastWorkout: lastWorkoutSummary,
        weeklySummary,
        weeklyVolume: Object.entries(weeklyVolumeMap).map(([week, volume]) => ({ week, volume: Math.round(volume as number) })),
    });
}
