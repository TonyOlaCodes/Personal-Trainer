import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths, format } from "date-fns";

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 1. Fetch completed workout logs with sets and exercises
    const logs = (await prisma.workoutLog.findMany({
        where: { userId: user.id, status: "COMPLETED" },
        include: {
            sets: {
                include: {
                    exercise: { select: { name: true, muscleGroup: true } }
                }
            }
        },
        orderBy: { loggedAt: "asc" }
    })) as any[];

    // 2. Aggregate stats
    const exerciseHistory: Record<string, any[]> = {};
    const muscleVolume: Record<string, number> = {};
    const workoutFrequencies: Record<string, number> = {};
    const sessionDurations: { date: string, duration: number }[] = [];
    const prsCount = logs.reduce((acc, log) => acc + (log.sets as any[]).filter((s) => s.isPR).length, 0);

    logs.forEach(log => {
        const dateStr = format(log.loggedAt, "MMM dd");
        
        if (log.duration) {
            sessionDurations.push({ date: dateStr, duration: log.duration });
        }

        // Frequency mapping
        const monthKey = format(log.loggedAt, "MMM yyyy");
        workoutFrequencies[monthKey] = (workoutFrequencies[monthKey] || 0) + 1;

        log.sets.forEach(set => {
            if (!set.exercise) return;
            const exName = set.exercise.name;
            const mg = set.exercise.muscleGroup || "Other";

            // Volume by muscle group
            if (set.weightKg) {
                const vol = (set.weightKg * set.reps);
                muscleVolume[mg] = (muscleVolume[mg] || 0) + vol;
            }

            // Exercise progress history (Top set / Est 1RM)
            if (!exerciseHistory[exName]) exerciseHistory[exName] = [];
            
            // For now, let's just track the max weight for each session
            const sessionMax = set.weightKg || 0;
            const existingSession = exerciseHistory[exName].find(h => h.date === dateStr);
            if (existingSession) {
                existingSession.weight = Math.max(existingSession.weight, sessionMax);
                existingSession.volume += (set.weightKg || 0) * set.reps;
            } else {
                exerciseHistory[exName].push({
                    date: dateStr,
                    weight: sessionMax,
                    reps: set.reps,
                    volume: (set.weightKg || 0) * set.reps
                });
            }
        });
    });

    return NextResponse.json({
        totalWorkouts: logs.length,
        totalPRs: prsCount,
        muscleVolume,
        exerciseHistory,
        sessionDurations,
        workoutFrequencies: Object.entries(workoutFrequencies).map(([month, count]) => ({ month, count })),
        recentLogs: logs.slice(-10).reverse()
    });
}
