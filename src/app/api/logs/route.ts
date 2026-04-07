import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const logSchema = z.object({
    workoutId: z.string(),
    duration: z.number().optional(),
    notes: z.string().optional(),
    feeling: z.number().min(1).max(5).optional(),
    status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("COMPLETED"),
    loggedAt: z.string().optional(), // ISO date string for retroactive logging
    sets: z.array(z.object({
        exerciseId: z.string(),
        exerciseName: z.string().optional(),
        setNumber: z.number(),
        reps: z.number().optional(),
        weightKg: z.number().optional(),
        rpe: z.number().min(1).max(10).optional(),
        isWarmup: z.boolean().default(false),
        isCompleted: z.boolean().default(true),
        videoUrl: z.string().optional(),
    })),
});

// POST log a completed or in-progress workout
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const parsed = logSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { workoutId, duration, notes, feeling, sets, status, loggedAt } = parsed.data;

    // Detect PRs: only for completed sets that aren't warmups
    const prExerciseIds = new Set<string>();
    if (status === "COMPLETED") {
        for (const s of sets) {
            if (!s.weightKg || s.isWarmup || !s.isCompleted) continue;
            const prev = await prisma.logSet.findFirst({
                where: {
                    exerciseId: s.exerciseId,
                    workoutLog: { userId: user.id },
                    weightKg: { not: null },
                    isWarmup: false,
                    isCompleted: true,
                },
                orderBy: { weightKg: "desc" },
            });
            if (!prev?.weightKg || s.weightKg > prev.weightKg) {
                prExerciseIds.add(s.exerciseId);
            }
        }
    }

    // Delete existing IN_PROGRESS log for this workout if it exists to avoid duplicates
    await prisma.workoutLog.deleteMany({
        where: { userId: user.id, workoutId, status: "IN_PROGRESS" }
    });

    // Process exercises to get real IDs safely (avoiding race conditions)
    const tempToRealId = new Map<string, string>();
    
    for (const s of sets) {
        if ((s.exerciseId.startsWith("new-") || s.exerciseId.includes(":sub")) && !tempToRealId.has(s.exerciseId)) {
            const exName = s.exerciseName || "Custom Exercise";
            
            // Try to find an existing exercise by name in this specific workout to avoid cluttering with duplicates
            let existingEx = await prisma.exercise.findFirst({
                where: { workoutId, name: exName }
            });

            if (!existingEx) {
                existingEx = await prisma.exercise.create({
                    data: {
                        workoutId,
                        name: exName,
                        sets: 1,
                        reps: "10",
                    }
                });
            }
            tempToRealId.set(s.exerciseId, existingEx.id);
        }
    }

    const setsWithRealIds = sets.map(s => ({
        ...s,
        exerciseId: tempToRealId.get(s.exerciseId) || s.exerciseId
    }));

    const workoutLog = await prisma.workoutLog.create({
        data: {
            userId: user.id,
            workoutId,
            duration,
            notes,
            feeling,
            status: status as any,
            ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
            sets: {
                create: setsWithRealIds.map((s) => ({
                    exerciseId: s.exerciseId,
                    setNumber: s.setNumber,
                    reps: s.reps,
                    weightKg: s.weightKg,
                    rpe: s.rpe,
                    isWarmup: s.isWarmup,
                    isCompleted: s.isCompleted,
                    isPR: prExerciseIds.has(s.exerciseId),
                    videoUrl: s.videoUrl,
                })),
            },
        },
        include: { sets: true },
    });

    return NextResponse.json(workoutLog, { status: 201 });
}

// GET recent logs or active session
export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") === "true";
    const limit = parseInt(url.searchParams.get("limit") ?? "20");

    if (activeOnly) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeLog = await prisma.workoutLog.findFirst({
            where: { 
                userId: user.id, 
                status: "IN_PROGRESS",
                updatedAt: { gte: twentyFourHoursAgo }
            },
            include: {
                workout: { select: { name: true, id: true } },
                sets: {
                    include: {
                        exercise: {
                            select: {
                                id: true,
                                name: true,
                                sets: true,
                                reps: true,
                                weightTargetKg: true,
                                notes: true,
                            }
                        }
                    },
                    orderBy: { setNumber: "asc" }
                }
            },
            orderBy: { updatedAt: "desc" }
        });
        return NextResponse.json(activeLog);
    }

    const logs = await prisma.workoutLog.findMany({
        where: { userId: user.id, status: "COMPLETED" },
        include: {
            workout: { select: { name: true, dayNumber: true } },
            sets: { include: { exercise: { select: { name: true, muscleGroup: true } } } },
        },
        orderBy: { loggedAt: "desc" },
        take: limit,
    });

    return NextResponse.json(logs);
}
