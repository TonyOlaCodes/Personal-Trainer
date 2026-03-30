import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval, startOfMonth, startOfYear } from "date-fns";

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
    
    // Volume Aggregations
    const dailyVolumeMap: Record<string, number> = {};
    const weeklyVolumeMap: Record<string, number> = {};
    const monthlyVolumeMap: Record<string, number> = {};
    const yearlyVolumeMap: Record<string, number> = {};

    const exercisePRs: Record<string, { weight: number; reps: number; date: string; prevWeight: number }> = {};

    const big3: Record<string, { weight: number; reps: number; date: string; change: number }> = {
        "Bench Press": { weight: 0, reps: 0, date: "", change: 0 },
        "Squat": { weight: 0, reps: 0, date: "", change: 0 },
        "Deadlift": { weight: 0, reps: 0, date: "", change: 0 }
    };

    const sbdByDate: Record<string, { date: string; squat: number | null; bench: number | null; deadlift: number | null }> = {};

    const now = new Date();
    const thisWeekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    const lastWeekRange = { start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) };

    let workoutsThisWeek = 0;
    let workoutsLastWeek = 0;
    let totalVolumeThisWeek = 0;
    let totalVolumeLastWeek = 0;

    let lastWorkoutSummary: any = null;

    logs.forEach(log => {
        const dateStr = format(log.loggedAt, "MMM dd");
        const dayKey = format(log.loggedAt, "yyyy-MM-dd");
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
            weeklyVolumeMap[weekKey] = (weeklyVolumeMap[weekKey] || 0) + sVol;
            monthlyVolumeMap[monthKey] = (monthlyVolumeMap[monthKey] || 0) + sVol;
            yearlyVolumeMap[yearKey] = (yearlyVolumeMap[yearKey] || 0) + sVol;

            if (isThisWeek) totalVolumeThisWeek += sVol;
            if (isLastWeek) totalVolumeLastWeek += sVol;

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
                if (!sbdByDate[dateStr]) sbdByDate[dateStr] = { date: dateStr, squat: null, bench: null, deadlift: null };
                const fieldKey = big3Key === "Squat" ? "squat" : big3Key === "Bench Press" ? "bench" : "deadlift";
                const curVal = sbdByDate[dateStr][fieldKey] ?? 0;
                if (sWeight > curVal) sbdByDate[dateStr][fieldKey] = sWeight;
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
            const currentOneRM = sWeight > 0 ? Math.round(sWeight * (1 + sReps / 30)) : 0;

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
                exerciseHistory[exName].push({ date: dateStr, weight: sWeight, reps: sReps, volume: sVol, oneRM: currentOneRM });
            }
        });

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

    const bodyweightHistory = [
        ...(user.weightKg ? [{ date: format(user.createdAt, "MMM dd"), weight: user.weightKg }] : []),
        ...user.checkIns.filter((c: any) => c.bodyweightKg).map((c: any) => ({
            date: format(c.createdAt, "MMM dd"),
            weight: c.bodyweightKg
        }))
    ];

    const currentWeight = bodyweightHistory[bodyweightHistory.length - 1]?.weight || user.weightKg || 0;
    const startWeight = bodyweightHistory[0]?.weight || user.weightKg || 0;
    const recentCheckins = user.checkIns.filter((c: any) => c.bodyweightKg && c.createdAt >= subWeeks(now, 2));
    const weightChangeWeek = recentCheckins.length > 1
        ? (recentCheckins[recentCheckins.length - 1]?.bodyweightKg || currentWeight) - (recentCheckins[0]?.bodyweightKg || currentWeight)
        : 0;

    const prList = Object.entries(exercisePRs)
        .filter(([_, pr]) => pr.weight > 0)
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
    const volumeChange = totalVolumeLastWeek > 0 ? Math.round(((totalVolumeThisWeek - totalVolumeLastWeek) / totalVolumeLastWeek) * 100) : 0;

    const weeklySummary = {
        workouts: workoutsThisWeek,
        target: user.trainingDaysPerWeek || 4,
        totalVolume: Math.round(totalVolumeThisWeek),
        volumeChange,
        weightChange: Math.round(weightChangeWeek * 10) / 10,
        currentWeight,
        prsThisWeek: prList.filter(pr => pr.improvement > 0).length
    };

    const sbdTimeline = Object.values(sbdByDate).sort((a, b) => a.date.localeCompare(b.date));
    let lastS=0, lastB=0, lastD=0;
    const sbdTimelineFilled = sbdTimeline.map(row => {
        if (row.squat !== null) lastS = row.squat;
        if (row.bench !== null) lastB = row.bench;
        if (row.deadlift !== null) lastD = row.deadlift;
        return { date: row.date, squat: lastS || null, bench: lastB || null, deadlift: lastD || null };
    });

    const volumes = {
        daily: Object.entries(dailyVolumeMap).map(([label, volume]) => ({ label, volume: Math.round(volume as number) })).slice(-30),
        weekly: Object.entries(weeklyVolumeMap).map(([label, volume]) => ({ label, volume: Math.round(volume as number) })).slice(-12),
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
        big3,
        sbdTimeline: sbdTimelineFilled,
        muscleVolume,
        exerciseHistory,
        prList,
        topExercises,
        lastWorkout: lastWorkoutSummary,
        weeklySummary,
        volumes
    });
}
