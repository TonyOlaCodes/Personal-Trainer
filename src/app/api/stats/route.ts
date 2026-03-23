import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths, format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";

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

    // 1. Fetch completed workout logs
    const logs = await prisma.workoutLog.findMany({
        where: { userId: user.id, status: "COMPLETED" },
        include: {
            sets: {
                include: {
                    exercise: { select: { name: true, muscleGroup: true } }
                }
            }
        },
        orderBy: { loggedAt: "asc" }
    }) as any[];

    // 2. Aggregate stats
    const exerciseHistory: Record<string, any[]> = {};
    const muscleVolume: Record<string, number> = {};
    const workoutFrequencies: Record<string, number> = {};
    const sessionDurations: { date: string, duration: number }[] = [];
    
    // Weekly Volume Trend
    const weeklyVolume: Record<string, number> = {};
    
    // Big 3 Tracking
    const big3: Record<string, { weight: number, reps: number, oneRM: number, date: string, change: number }> = {
        "Bench Press": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 },
        "Squat": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 },
        "Deadlift": { weight: 0, reps: 0, oneRM: 0, date: "", change: 0 }
    };

    const now = new Date();
    const thisWeekRange = { start: startOfWeek(now), end: endOfWeek(now) };
    const lastWeekRange = { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) };
    
    let workoutsThisWeek = 0;
    let workoutsLastWeek = 0;

    logs.forEach(log => {
        const dateStr = format(log.loggedAt, "MMM dd");
        const weekKey = format(startOfWeek(log.loggedAt), "MMM dd");
        
        if (isWithinInterval(log.loggedAt, thisWeekRange)) workoutsThisWeek++;
        if (isWithinInterval(log.loggedAt, lastWeekRange)) workoutsLastWeek++;

        if (log.duration) {
            sessionDurations.push({ date: dateStr, duration: log.duration });
        }

        const monthKey = format(log.loggedAt, "MMM yyyy");
        workoutFrequencies[monthKey] = (workoutFrequencies[monthKey] || 0) + 1;

        log.sets.forEach((set: any) => {
            if (!set.exercise) return;
            const exName = set.exercise.name;
            const mg = set.exercise.muscleGroup || "Other";
            const sWeight = set.weightKg || 0;
            const sReps = set.reps || 0;
            const sVol = sWeight * sReps;

            // Volume tracking
            muscleVolume[mg] = (muscleVolume[mg] || 0) + sVol;
            weeklyVolume[weekKey] = (weeklyVolume[weekKey] || 0) + sVol;

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
                        weight: sWeight,
                        reps: sReps,
                        oneRM: oneRM,
                        date: dateStr,
                        change: prev1RM > 0 ? oneRM - prev1RM : 0
                    };
                }
            }

            // Exercise progress history
            if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
            const existingSession = exerciseHistory[exName].find(h => h.date === dateStr);
            if (existingSession) {
                if (sWeight > existingSession.weight) {
                    existingSession.weight = sWeight;
                    existingSession.reps = sReps;
                }
                existingSession.volume += sVol;
            } else {
                exerciseHistory[exName].push({
                    date: dateStr,
                    weight: sWeight,
                    reps: sReps,
                    volume: sVol
                });
            }
        });
    });

    // Bodyweight History
    const bodyweightHistory = [
        ...(user.weightKg ? [{ date: format(user.createdAt, "MMM dd"), weight: user.weightKg }] : []),
        ...user.checkIns.filter(c => c.bodyweightKg).map(c => ({
            date: format(c.createdAt, "MMM dd"),
            weight: c.bodyweightKg
        }))
    ];

    const currentWeight = bodyweightHistory[bodyweightHistory.length - 1]?.weight || user.weightKg || 0;
    const startWeight = bodyweightHistory[0]?.weight || user.weightKg || 0;
    
    // Weight change this week (last 7 days vs previous 7)
    const weekAgo = subWeeks(now, 1);
    const weightThisWeek = bodyweightHistory.find(h => new Date(h.date) >= weekAgo)?.weight || currentWeight;
    const weightChangeWeek = bodyweightHistory.length > 1 ? currentWeight - weightThisWeek : 0;

    return NextResponse.json({
        totalWorkouts: logs.length,
        consistency: {
            thisWeek: workoutsThisWeek,
            lastWeek: workoutsLastWeek,
            target: user.trainingDaysPerWeek || 4
        },
        bodyweight: {
            current: currentWeight,
            changeWeek: weightChangeWeek,
            totalChange: currentWeight - startWeight,
            history: bodyweightHistory
        },
        big3,
        muscleVolume,
        exerciseHistory,
        sessionDurations,
        weeklyVolume: Object.entries(weeklyVolume).map(([week, volume]) => ({ week, volume })),
        workoutFrequencies: Object.entries(workoutFrequencies).map(([month, count]) => ({ month, count })),
    });
}
