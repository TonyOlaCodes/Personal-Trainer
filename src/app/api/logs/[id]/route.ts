import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkoutNotes } from "@/lib/workoutNotes";

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
        sets: log.sets.map((set) => ({
            id: set.id,
            setNumber: set.setNumber,
            reps: set.reps,
            weightKg: set.weightKg,
            rpe: set.rpe,
            isWarmup: set.isWarmup,
            isCompleted: set.isCompleted,
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
    const { status } = body;

    if (!["IN_PROGRESS", "COMPLETED"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.workoutLog.findFirst({
        where: { id, userId: user.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.workoutLog.update({
        where: { id },
        data: { status }
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
