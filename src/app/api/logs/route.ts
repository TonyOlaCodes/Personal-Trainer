import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { getLocalDayBounds, parseLogDate } from "@/lib/utils";
import { requireAuthUser, resolveWorkoutLogReadUserId, resolveWorkoutLogSubjectUserId, workoutAssignedToUser } from "@/lib/apiAuth";
import { notifyCoachOfClientWorkout } from "@/lib/notifications";
import { triggerAchievementSync } from "@/lib/achievements";
import { normalizeStoredUploadUrl } from "@/lib/uploadUrls";
import { ensureLogSetExerciseNameColumn } from "@/lib/logSetExerciseName";
import { z } from "zod";

const logSchema = z.object({
    workoutId: z.string(),
    clientId: z.string().optional(),
    duration: z.number().optional(),
    notes: z.string().optional(),
    feeling: z.number().min(1).max(5).optional(),
    status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("COMPLETED"),
    loggedAt: z.string().optional(), // ISO date string for retroactive logging
    sets: z.array(z.object({
        exerciseId: z.string(),
        exerciseName: z.string().optional(),
        exerciseOrder: z.number().optional(),
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
    await ensureDbSchema();
    await ensureLogSetExerciseNameColumn();
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await req.json();
    const parsed = logSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { workoutId, clientId, duration, notes, feeling, sets, status, loggedAt } = parsed.data;

    const subjectResult = await resolveWorkoutLogSubjectUserId(user, clientId);
    if (subjectResult.error) return subjectResult.error;
    const subjectUserId = subjectResult.subjectUserId;

    if (!(await workoutAssignedToUser(subjectUserId, workoutId))) {
        return NextResponse.json({ error: "Workout is not part of your assigned plans" }, { status: 403 });
    }

    const subjectProfile =
        subjectUserId === user.id
            ? { coachId: user.coachId, name: user.name, email: user.email }
            : await prisma.user.findUnique({
                where: { id: subjectUserId },
                select: { coachId: true, name: true, email: true },
            });

    const maybeNotifyCoach = async (workoutLog: { id: string; workout: { name: string } }) => {
        if (status !== "COMPLETED" || subjectUserId !== user.id) return;
        if (!subjectProfile?.coachId) return;
        await notifyCoachOfClientWorkout({
            coachId: subjectProfile.coachId,
            clientName: subjectProfile.name ?? subjectProfile.email ?? "Client",
            workoutName: workoutLog.workout.name,
            workoutLogId: workoutLog.id,
        });
    };

    // Detect PRs: only for completed sets that aren't warmups
    const prExerciseIds = new Set<string>();
    if (status === "COMPLETED") {
        for (const s of sets) {
            if (!s.weightKg || s.isWarmup || !s.isCompleted) continue;
            const prev = await prisma.logSet.findFirst({
                where: {
                    exerciseId: s.exerciseId,
                    workoutLog: { userId: subjectUserId },
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

    const targetDate = loggedAt ? parseLogDate(loggedAt) : new Date();
    const { start: startOfDay, end: endOfDay } = getLocalDayBounds(targetDate);

    const existingInProgress = await prisma.workoutLog.findFirst({
        where: {
            userId: subjectUserId,
            workoutId,
            status: "IN_PROGRESS",
            loggedAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { updatedAt: "desc" },
    });

    // Drop stale in-progress drafts only when starting a fresh session
    if (status === "IN_PROGRESS" && !existingInProgress) {
        await prisma.workoutLog.deleteMany({
            where: {
                userId: subjectUserId,
                workoutId,
                status: "IN_PROGRESS",
                loggedAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });
    }

    const existingCompleted =
        status === "COMPLETED"
            ? await prisma.workoutLog.findFirst({
                  where: {
                      userId: subjectUserId,
                      workoutId,
                      status: "COMPLETED",
                      loggedAt: { gte: startOfDay, lte: endOfDay },
                  },
                  orderBy: { updatedAt: "desc" },
              })
            : null;

    // Resolve temp/custom exercise IDs — never mutate plan exercise order from a log save
    const tempToRealId = new Map<string, string>();

    for (const s of sets) {
        if (!(s.exerciseId.startsWith("new-") || s.exerciseId.includes(":sub"))) continue;
        if (tempToRealId.has(s.exerciseId)) continue;

        const exName = s.exerciseName || "Custom Exercise";
        let existingEx = await prisma.exercise.findFirst({
            where: { workoutId, name: exName },
        });

        if (!existingEx) {
            existingEx = await prisma.exercise.create({
                data: {
                    workoutId,
                    name: exName,
                    sets: 1,
                    reps: "10",
                    order: s.exerciseOrder ?? 999,
                    isCustom: true,
                },
            });
        }

        tempToRealId.set(s.exerciseId, existingEx.id);
    }

    const exerciseNameById = new Map<string, string>();
    for (const s of sets) {
        const resolvedId = tempToRealId.get(s.exerciseId) || s.exerciseId;
        if (s.exerciseName?.trim()) {
            exerciseNameById.set(resolvedId, s.exerciseName.trim());
        }
    }

    const unresolvedIds = [...new Set(
        sets
            .map((s) => tempToRealId.get(s.exerciseId) || s.exerciseId)
            .filter((id) => !exerciseNameById.has(id))
    )];
    if (unresolvedIds.length > 0) {
        const exercises = await prisma.exercise.findMany({
            where: { id: { in: unresolvedIds } },
            select: { id: true, name: true },
        });
        for (const exercise of exercises) {
            exerciseNameById.set(exercise.id, exercise.name.trim());
        }
    }

    const setsWithRealIds = sets.map((s) => ({
        ...s,
        exerciseId: tempToRealId.get(s.exerciseId) || s.exerciseId,
    }));

    const logPayload = {
        duration,
        notes,
        feeling,
        status: status as "IN_PROGRESS" | "COMPLETED",
        loggedAt: loggedAt ? parseLogDate(loggedAt) : new Date(),
    };

    const setsCreate = setsWithRealIds.map((s) => ({
        exerciseId: s.exerciseId,
        exerciseName: exerciseNameById.get(s.exerciseId) ?? s.exerciseName?.trim() ?? "Unknown",
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: s.weightKg,
        rpe: s.rpe,
        isWarmup: s.isWarmup,
        isCompleted: s.isCompleted,
        isPR: prExerciseIds.has(s.exerciseId),
        videoUrl: s.videoUrl ? normalizeStoredUploadUrl(s.videoUrl) ?? s.videoUrl : undefined,
    }));

    if (status === "COMPLETED" && existingInProgress) {
        if (existingCompleted && existingCompleted.id !== existingInProgress.id) {
            await prisma.workoutLog.delete({ where: { id: existingCompleted.id } });
        }
        await prisma.logSet.deleteMany({ where: { workoutLogId: existingInProgress.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingInProgress.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        await maybeNotifyCoach(workoutLog);
        triggerAchievementSync(subjectUserId);
        return NextResponse.json(workoutLog, { status: 200 });
    }

    if (existingCompleted) {
        await prisma.logSet.deleteMany({ where: { workoutLogId: existingCompleted.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingCompleted.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        triggerAchievementSync(subjectUserId);
        return NextResponse.json(workoutLog, { status: 200 });
    }

    if (existingInProgress) {
        await prisma.logSet.deleteMany({ where: { workoutLogId: existingInProgress.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingInProgress.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        triggerAchievementSync(subjectUserId);
        return NextResponse.json(workoutLog, { status: 200 });
    }

    const workoutLog = await prisma.workoutLog.create({
        data: {
            userId: subjectUserId,
            workoutId,
            ...logPayload,
            sets: { create: setsCreate },
        },
        include: { sets: true, workout: { select: { name: true } } },
    });

    if (status === "COMPLETED") {
        await prisma.workoutLog.deleteMany({
            where: {
                userId: subjectUserId,
                workoutId,
                status: "IN_PROGRESS",
                loggedAt: { gte: startOfDay, lte: endOfDay },
                id: { not: workoutLog.id },
            },
        });
    }

    await maybeNotifyCoach(workoutLog);

    triggerAchievementSync(subjectUserId);

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
        const workoutId = url.searchParams.get("workoutId");
        const dateParam = url.searchParams.get("date");

        const activeInclude = {
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
                            order: true,
                        },
                    },
                },
                orderBy: { setNumber: "asc" as const },
            },
        };

        if (workoutId && dateParam) {
            const clientId = url.searchParams.get("clientId");
            const readTarget = await resolveWorkoutLogReadUserId(user, clientId);
            if (readTarget.error) return readTarget.error;

            const { start, end } = getLocalDayBounds(parseLogDate(dateParam));
            const activeLog = await prisma.workoutLog.findFirst({
                where: {
                    userId: readTarget.targetUserId,
                    workoutId,
                    status: "IN_PROGRESS",
                    loggedAt: { gte: start, lte: end },
                },
                include: activeInclude,
                orderBy: { updatedAt: "desc" },
            });
            return NextResponse.json(activeLog);
        }

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeLog = await prisma.workoutLog.findFirst({
            where: {
                userId: user.id,
                status: "IN_PROGRESS",
                updatedAt: { gte: twentyFourHoursAgo },
            },
            include: activeInclude,
            orderBy: { updatedAt: "desc" },
        });
        return NextResponse.json(activeLog);
    }

    const history = url.searchParams.get("history") === "true";
    if (history) {
        let targetUserId = user.id;
        const requestedUserId = url.searchParams.get("userId");
        if (requestedUserId && requestedUserId !== user.id) {
            const target = await prisma.user.findUnique({
                where: { id: requestedUserId },
                select: { id: true, coachId: true },
            });
            if (!target) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            const isCoachForClient =
                user.role === "COACH" && target.coachId === user.id;
            const isAdmin = user.role === "SUPER_ADMIN";
            if (!isCoachForClient && !isAdmin) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            targetUserId = target.id;
        }

        const historyLogs = await prisma.workoutLog.findMany({
            where: { userId: targetUserId, status: "COMPLETED" },
            select: {
                id: true,
                loggedAt: true,
                workout: { select: { name: true } },
                sets: { where: { isCompleted: true }, select: { id: true } },
            },
            orderBy: { loggedAt: "desc" },
        });

        return NextResponse.json(
            historyLogs.map((log) => ({
                id: log.id,
                workoutName: log.workout.name,
                loggedAt: log.loggedAt.toISOString(),
                setCount: log.sets.length,
            }))
        );
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
