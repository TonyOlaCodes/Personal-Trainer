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

    // Create any new/ad-hoc exercises first
    const setsWithRealIds = await Promise.all(sets.map(async (s) => {
        // If it's a new ad-hoc exercise or a substituted one (client gives us a temporary ID)
        if (s.exerciseId.startsWith("new-") || s.exerciseId.includes(":sub")) {
            // Find existing exercise by name for this workout first to avoid duplicates
            let existingEx = await prisma.exercise.findFirst({
                where: { workoutId, name: s.exerciseName }
            });

            if (!existingEx) {
                existingEx = await prisma.exercise.create({
                    data: {
                        workoutId,
                        name: s.exerciseName || "Custom Exercise",
                        sets: 1,
                        reps: "10",
                    }
                });
            }
            return { ...s, exerciseId: existingEx.id };
        }
        return s;
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
                sets: true
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
