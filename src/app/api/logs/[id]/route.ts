import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withResolvedLogSetMedia } from "@/lib/uploadUrls";
import { z } from "zod";

const patchLogSchema = z.object({
    status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
    feeling: z.number().int().min(1).max(5).optional(),
}).refine((data) => data.status !== undefined || data.feeling !== undefined, {
    message: "Provide status or feeling to update",
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
                orderBy: [{ exercise: { order: "asc" } }, { setNumber: "asc" }],
            },
        },
    });

    if (!log) return NextResponse.json({ error: "Item no longer available" }, { status: 404 });

    const canView = log.userId === user.id || user.role === "SUPER_ADMIN" || log.user.coachId === user.id;
    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({
        id: log.id,
        workoutId: log.workoutId,
        workoutName: log.workout.name,
        userId: log.userId,
        clientName: log.user.name,
        loggedAt: log.loggedAt,
        duration: log.duration,
        notes: log.notes,
        feeling: log.feeling,
        status: log.status,
        sets: log.sets.map((set) => withResolvedLogSetMedia({
            id: set.id,
            setNumber: set.setNumber,
            reps: set.reps,
            weightKg: set.weightKg,
            rpe: set.rpe,
            isWarmup: set.isWarmup,
            isCompleted: set.isCompleted,
            videoUrl: set.videoUrl,
            exercise: set.exercise,
        })),
        coachNotes: await getWorkoutNotes(log.id),
    });
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

    const existing = await prisma.workoutLog.findFirst({
        where: { id, userId: user.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.workoutLog.findFirst({
        where: { id, userId: user.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.workoutLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
