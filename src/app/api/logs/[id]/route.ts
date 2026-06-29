import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withResolvedLogSetMedia } from "@/lib/uploadUrls";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { getWorkoutNotes } from "@/lib/workoutNotes";
import { canEditWorkoutLog, canViewWorkoutLog } from "@/lib/userProfile";
import { triggerAchievementSync } from "@/lib/achievements";
import { z } from "zod";

const patchLogSchema = z.object({
    status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
    feeling: z.number().int().min(1).max(5).optional(),
}).refine((data) => data.status !== undefined || data.feeling !== undefined, {
    message: "Provide status or feeling to update",
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const log = await prisma.workoutLog.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, coachId: true } },
                workout: { select: { id: true, name: true } },
                sets: {
                    include: { exercise: { select: { id: true, name: true, muscleGroup: true } } },
                    orderBy: logSetDisplayOrderBy,
                },
            },
        });

        if (!log) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        const canView = await canViewWorkoutLog(user, { ...log, user: log.user });
        if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const coachNotes = await getWorkoutNotes(log.id);

        return NextResponse.json({
            id: log.id,
            workoutId: log.workoutId,
            workoutName: log.workout.name,
            userId: log.userId,
            clientName: log.user.name,
            loggedAt: log.loggedAt,
            updatedAt: log.updatedAt,
            duration: log.duration,
            notes: log.notes,
            feeling: log.feeling,
            status: log.status,
            sets: log.sets.map((set) => withResolvedLogSetMedia({
                id: set.id,
                exerciseId: set.exerciseId,
                setNumber: set.setNumber,
                reps: set.reps,
                weightKg: set.weightKg,
                rpe: set.rpe,
                isWarmup: set.isWarmup,
                isCompleted: set.isCompleted,
                videoUrl: set.videoUrl,
                exercise: {
                    ...set.exercise,
                    name: resolveLogSetExerciseName(set),
                },
            })),
            coachNotes: coachNotes.map((note) => ({
                ...note,
                createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
            })),
        });
    } catch (error) {
        console.error("GET /api/logs/[id] error:", error);
        return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const parsed = patchLogSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten().formErrors[0] || "Invalid update" }, { status: 400 });
    }

    const existing = await prisma.workoutLog.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    coachId: true,
                    isDeleted: true,
                    isDeactivated: true,
                    email: true,
                },
            },
        },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!(await canEditWorkoutLog(user, existing))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: { status?: "IN_PROGRESS" | "COMPLETED"; feeling?: number } = {};

    if (parsed.data.status !== undefined) {
        data.status = parsed.data.status;
    }

    if (parsed.data.feeling !== undefined) {
        if (existing.status !== "COMPLETED") {
            return NextResponse.json({ error: "Can only update feeling on completed workouts" }, { status: 400 });
        }
        data.feeling = parsed.data.feeling;
    }

    const updated = await prisma.workoutLog.update({
        where: { id },
        data,
    });

    if (data.status === "COMPLETED") {
        triggerAchievementSync(existing.userId);
    }

    return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.workoutLog.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    coachId: true,
                    isDeleted: true,
                    isDeactivated: true,
                    email: true,
                },
            },
        },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!(await canEditWorkoutLog(user, existing))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workoutLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
