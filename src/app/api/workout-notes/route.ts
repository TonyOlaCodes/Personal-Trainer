import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification, userWantsNotification } from "@/lib/notifications";
import { createWorkoutNote, getWorkoutNotes } from "@/lib/workoutNotes";

const postSchema = z.object({
    workoutLogId: z.string(),
    text: z.string().trim().min(1).max(2000),
});

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const workoutLogId = url.searchParams.get("workoutLogId");
    if (!workoutLogId) return NextResponse.json({ error: "Missing workoutLogId" }, { status: 400 });

    const log = await prisma.workoutLog.findUnique({
        where: { id: workoutLogId },
        select: { userId: true, user: { select: { coachId: true } } },
    });
    if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canView = actor.id === log.userId || actor.role === "SUPER_ADMIN" || log.user.coachId === actor.id;
    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ notes: await getWorkoutNotes(workoutLogId) });
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const log = await prisma.workoutLog.findUnique({
        where: { id: parsed.data.workoutLogId },
        include: {
            user: { select: { id: true, coachId: true } },
            workout: { select: { name: true } },
        },
    });
    if (!log) return NextResponse.json({ error: "Workout session not found" }, { status: 404 });

    if (coach.role === "COACH" && log.user.coachId !== coach.id) {
        return NextResponse.json({ error: "Not your client" }, { status: 403 });
    }

    await createWorkoutNote(log.id, coach.id, parsed.data.text);
    if (await userWantsNotification(log.user.id, "notifyOnWorkoutFeedback")) {
        await createNotification({
            userId: log.user.id,
            type: "WORKOUT_FEEDBACK_ADDED",
            message: "Your coach added feedback to your workout",
            entityType: "WORKOUT_LOG",
            entityId: log.id,
            route: `/dashboard?sessionId=${log.id}`,
        });
    }

    return NextResponse.json({ success: true, notes: await getWorkoutNotes(log.id) }, { status: 201 });
}
