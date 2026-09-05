import { NextResponse } from "next/server";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { getLocalDayBounds, parseLogDate, toDateKey } from "@/lib/utils";
import { requireActiveUser, resolveWorkoutLogReadUserId, resolveWorkoutLogSubjectUserId, workoutAssignedToUser } from "@/lib/apiAuth";
import { ensureWorkoutLogConcurrencySchema } from "@/lib/workoutLogRevision";
import {
    acceptWorkoutRevision,
    incomingSetIsMeaningful,
    nextWorkoutRevision,
    shouldApplyInProgressSetReplacement,
    shouldEmitCompletionSideEffects,
    staleRevisionPayload,
} from "@/lib/workoutSavePolicy";
import { notifyCoachOfClientWorkout } from "@/lib/notifications";
import { triggerAchievementSync } from "@/lib/achievements";
import { canActorAttachUploads } from "@/lib/uploadAttachOwnership";
import { normalizeStoredUploadUrl } from "@/lib/uploadUrls";
import { ensureLogSetExerciseNameColumn } from "@/lib/logSetExerciseName";
import { ensureLogSetExerciseOrderColumn, resolvePersistedExerciseOrder } from "@/lib/logSetExerciseOrder";
import { logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import { loadAllTimeMetricRecordBoards } from "@/lib/exerciseRecordHistory";
import { EXERCISE_NOTE_MAX_LENGTH, saveLogExerciseNotes } from "@/lib/logExerciseNotes";
import { closeOtherActiveSessions, getActiveWorkoutSession, resumeWorkoutHref } from "@/lib/activeWorkoutSession";
import { ensureExerciseTrackingSchema } from "@/lib/exerciseTracking/ensure";
import { resolveTrackingSchema } from "@/lib/exerciseTracking/resolve";
import {
    applySetToMetricRecords,
    cloneMetricRecords,
    EMPTY_METRIC_RECORDS,
    evaluateMetricAwarePr,
    type MetricExerciseRecords,
} from "@/lib/exerciseTracking/prs";
import { calculateOneRM } from "@/lib/oneRepMax";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { z } from "zod";

const optionalNonNeg = z.number().min(0).optional();

const logSchema = z.object({
    workoutId: z.string(),
    clientId: z.string().optional(),
    duration: z.number().optional(),
    notes: z.string().optional(),
    feeling: z.number().min(1).max(5).optional(),
    status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("COMPLETED"),
    loggedAt: z.string().optional(), // ISO date string for retroactive logging
    /**
     * Explicit confirmation that any other in-progress session may be discarded so this
     * one can start. Without it, a conflicting active session returns 409.
     */
    replaceActiveSession: z.boolean().optional(),
    /** Server-issued revision the client last acknowledged. Required to update an existing log. */
    expectedRevision: z.number().int().min(0).optional(),
    sets: z.array(z.object({
        exerciseId: z.string(),
        exerciseName: z.string().optional(),
        exerciseOrder: z.number().optional(),
        setNumber: z.number(),
        reps: z.number().optional(),
        weightKg: z.number().optional(),
        rpe: z.number().min(1).max(10).optional(),
        durationSec: optionalNonNeg,
        distanceMeters: optionalNonNeg,
        heightCm: optionalNonNeg,
        resistance: optionalNonNeg,
        inclinePct: optionalNonNeg,
        calories: optionalNonNeg,
        heartRate: z.number().int().min(0).max(250).optional(),
        speedKph: optionalNonNeg,
        rir: optionalNonNeg,
        isWarmup: z.boolean().default(false),
        isCompleted: z.boolean().default(true),
        videoUrl: z.string().optional(),
    })),
    /** Optional per-exercise notes for this session. Never required to finish a workout. */
    exerciseNotes: z
        .array(
            z.object({
                exerciseId: z.string(),
                exerciseName: z.string().optional(),
                text: z.string().max(EXERCISE_NOTE_MAX_LENGTH),
            })
        )
        .optional(),
});

type ParsedLogSet = z.infer<typeof logSchema>["sets"][number];

function hasPerformedSetData(set: ParsedLogSet) {
    return (
        (typeof set.reps === "number" && set.reps > 0) ||
        (typeof set.weightKg === "number" && Number.isFinite(set.weightKg) && set.weightKg > 0) ||
        (typeof set.durationSec === "number" && set.durationSec > 0) ||
        (typeof set.distanceMeters === "number" && set.distanceMeters > 0) ||
        (typeof set.heightCm === "number" && set.heightCm > 0) ||
        (typeof set.speedKph === "number" && set.speedKph > 0) ||
        (typeof set.calories === "number" && set.calories > 0) ||
        (typeof set.resistance === "number" && set.resistance > 0)
    );
}

// POST log a completed or in-progress workout
export async function POST(req: Request) {
    await ensureDbSchema();
    await ensureLogSetExerciseNameColumn();
    await ensureLogSetExerciseOrderColumn();
    await ensureExerciseTrackingSchema();
    await ensureWorkoutLogConcurrencySchema();
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await req.json();
    const parsed = logSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { workoutId, clientId, duration, notes, feeling, status, loggedAt, replaceActiveSession, expectedRevision } = parsed.data;
    const sets = parsed.data.sets.map((set) => ({
        ...set,
        exerciseName: set.exerciseName ? canonicalExerciseName(set.exerciseName) : set.exerciseName,
        isCompleted: set.isCompleted || hasPerformedSetData(set),
    }));

    if (!(await canActorAttachUploads(user.id, sets.map((set) => set.videoUrl)))) {
        return NextResponse.json({ error: "You cannot attach another user's upload" }, { status: 403 });
    }

    const subjectResult = await resolveWorkoutLogSubjectUserId(user, clientId);
    if (subjectResult.error) return subjectResult.error;
    const subjectUserId = subjectResult.subjectUserId;

    // Client starting/completing a workout clears a coach-only pause.
    if (subjectUserId === user.id) {
        const { maybeAutoResumeCoachPausedClient } = await import("@/lib/coachClientPause");
        await maybeAutoResumeCoachPausedClient(user.id);
    }

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
        include: {
            sets: { select: { exerciseId: true } },
        },
    });

    if (status === "COMPLETED" && subjectUserId !== user.id && !existingInProgress) {
        return NextResponse.json(
            { error: "Only an active client workout session can be finished by a coach" },
            { status: 403 }
        );
    }

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

    // One active workout per user. Starting a different session requires explicit
    // replaceActiveSession confirmation — otherwise return 409 with the live session.
    if (status === "IN_PROGRESS") {
        const active = await getActiveWorkoutSession(subjectUserId);
        const targetDateKey = toDateKey(targetDate);
        const isSameSession = Boolean(
            active
            && active.workoutId === workoutId
            && active.dateKey === targetDateKey
        );

        if (active && !isSameSession && !replaceActiveSession) {
            return NextResponse.json(
                {
                    error: "ACTIVE_SESSION_EXISTS",
                    message: "A workout is already in progress. Resume it or end it before starting another.",
                    activeSession: {
                        id: active.id,
                        workoutId: active.workoutId,
                        workoutName: active.workoutName,
                        dateKey: active.dateKey,
                        resumeHref: resumeWorkoutHref(active),
                        completedSetCount: active.completedSetCount,
                        totalSetCount: active.totalSetCount,
                        isBackdated: active.isBackdated,
                    },
                },
                { status: 409 }
            );
        }

        await closeOtherActiveSessions({
            userId: subjectUserId,
            keepWorkoutId: workoutId,
            keepDayStart: startOfDay,
            keepDayEnd: endOfDay,
        });
    }

    const existingCompleted = await prisma.workoutLog.findFirst({
        where: {
            userId: subjectUserId,
            workoutId,
            status: "COMPLETED",
            loggedAt: { gte: startOfDay, lte: endOfDay },
        },
        include: { sets: true, workout: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
    });

    if (status === "IN_PROGRESS" && existingCompleted) {
        return NextResponse.json(existingCompleted, { status: 200 });
    }

    const currentRow = existingInProgress ?? existingCompleted;
    const currentRevision = currentRow?.revision ?? 0;
    const previousStatus = (existingInProgress?.status ?? existingCompleted?.status ?? null) as
        | "IN_PROGRESS"
        | "COMPLETED"
        | null;
    if (currentRow && !acceptWorkoutRevision(expectedRevision, currentRevision)) {
        return NextResponse.json(
            {
                ...staleRevisionPayload(currentRevision),
                log: existingInProgress ?? existingCompleted,
            },
            { status: 409 }
        );
    }
    const nextRevision = nextWorkoutRevision(currentRevision);
    const emitCompletionSideEffects = shouldEmitCompletionSideEffects(previousStatus, status);

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
        revision: nextRevision,
    };

    const exerciseOrderById = new Map<string, number>();
    for (const s of setsWithRealIds) {
        if (exerciseOrderById.has(s.exerciseId)) continue;
        exerciseOrderById.set(
            s.exerciseId,
            resolvePersistedExerciseOrder(s.exerciseOrder, exerciseOrderById.size)
        );
    }

    const resolvedSetName = (set: (typeof setsWithRealIds)[number]) =>
        exerciseNameById.get(set.exerciseId) ?? set.exerciseName?.trim() ?? "Unknown";

    /**
     * PRs are judged against history that excludes this session, so re-saving or
     * finishing an in-progress log cannot make a set compete with itself and flip its
     * own badge off. Warmups and incomplete sets never earn a record.
     * Boards are keyed by canonical exercise identity so aliases share history.
     */
    const prBySetIndex = new Map<number, boolean>();
    const prMetaBySetIndex = new Map<number, { kinds: string[]; label: string | null }>();
    if (status === "COMPLETED") {
        const excludeLogId = existingInProgress?.id ?? existingCompleted?.id;
        const recordsByKey = await loadAllTimeMetricRecordBoards(subjectUserId, { excludeLogId });

        const schemaByKey = new Map<string, Awaited<ReturnType<typeof resolveTrackingSchema>>>();
        const ensureSchema = async (name: string, key: string) => {
            if (!schemaByKey.has(key)) {
                schemaByKey.set(key, await resolveTrackingSchema(name));
            }
            return schemaByKey.get(key)!;
        };

        // Evaluate each set in order, advancing records within the session.
        const liveRecords = new Map<string, MetricExerciseRecords>();
        for (const [key, rec] of recordsByKey) {
            liveRecords.set(key, cloneMetricRecords(rec));
        }

        for (let index = 0; index < setsWithRealIds.length; index++) {
            const set = setsWithRealIds[index];
            const name = resolvedSetName(set);
            const key = exerciseIdentityKey(name) || name.toLowerCase();
            const schema = await ensureSchema(name, key);
            if (!liveRecords.has(key)) {
                liveRecords.set(key, cloneMetricRecords(EMPTY_METRIC_RECORDS));
            }
            const board = liveRecords.get(key)!;
            const metrics = {
                weightKg: set.weightKg ?? null,
                reps: set.reps ?? null,
                durationSec: set.durationSec ?? null,
                distanceMeters: set.distanceMeters ?? null,
                heightCm: set.heightCm ?? null,
                resistance: set.resistance ?? null,
                inclinePct: set.inclinePct ?? null,
                calories: set.calories ?? null,
                heartRate: set.heartRate ?? null,
                speedKph: set.speedKph ?? null,
                rpe: set.rpe ?? null,
                rir: set.rir ?? null,
                isWarmup: set.isWarmup,
                isCompleted: set.isCompleted,
            };
            const oneRm =
                (metrics.weightKg ?? 0) > 0 && (metrics.reps ?? 0) > 0
                    ? calculateOneRM(metrics.weightKg!, metrics.reps!)
                    : null;
            const pr = evaluateMetricAwarePr(metrics, board, schema, oneRm);
            if (pr.isPr) {
                prBySetIndex.set(index, true);
                prMetaBySetIndex.set(index, {
                    kinds: pr.kinds,
                    label: pr.label,
                });
            }
            applySetToMetricRecords(board, metrics, schema, oneRm);
        }
    }

    const setsCreate = setsWithRealIds.map((s, index) => ({
        exerciseId: s.exerciseId,
        exerciseName: resolvedSetName(s),
        exerciseOrder: exerciseOrderById.get(s.exerciseId) ?? 999,
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: s.weightKg,
        rpe: s.rpe,
        durationSec: s.durationSec ?? null,
        distanceMeters: s.distanceMeters ?? null,
        heightCm: s.heightCm ?? null,
        resistance: s.resistance ?? null,
        inclinePct: s.inclinePct ?? null,
        calories: s.calories ?? null,
        heartRate: s.heartRate ?? null,
        speedKph: s.speedKph ?? null,
        rir: s.rir ?? null,
        isWarmup: s.isWarmup,
        isCompleted: s.isCompleted,
        isPR: prBySetIndex.get(index) ?? false,
        prKinds: prMetaBySetIndex.get(index)?.kinds?.length
            ? JSON.stringify(prMetaBySetIndex.get(index)!.kinds)
            : null,
        prLabel: prMetaBySetIndex.get(index)?.label ?? null,
        videoUrl: s.videoUrl ? normalizeStoredUploadUrl(s.videoUrl) ?? s.videoUrl : undefined,
    }));

    /** Notes are keyed by the resolved exercise id so swapped-in exercises keep theirs. */
    const exerciseNotesToSave = (parsed.data.exerciseNotes ?? []).map((note) => ({
        exerciseId: tempToRealId.get(note.exerciseId) ?? note.exerciseId,
        exerciseName: note.exerciseName,
        text: note.text,
    }));

    /** Notes must never take a workout save down with them. */
    const persistExerciseNotes = async (workoutLogId: string) => {
        if (parsed.data.exerciseNotes === undefined) return;
        try {
            await saveLogExerciseNotes(workoutLogId, exerciseNotesToSave);
        } catch (error) {
            console.error("[logs] Failed to save exercise notes", workoutLogId, error);
        }
    };

    if (status === "COMPLETED" && existingInProgress) {
        if (existingCompleted && existingCompleted.id !== existingInProgress.id) {
            const workoutLog = await prisma.$transaction(async (tx) => {
                await tx.logSet.deleteMany({ where: { workoutLogId: existingCompleted.id } });
                const updatedCompleted = await tx.workoutLog.update({
                    where: { id: existingCompleted.id },
                    data: { ...logPayload, sets: { create: setsCreate } },
                    include: { sets: true, workout: { select: { name: true } } },
                });
                await tx.logSet.deleteMany({ where: { workoutLogId: existingInProgress.id } });
                await tx.workoutLog.deleteMany({
                    where: {
                        id: existingInProgress.id,
                        status: "IN_PROGRESS",
                    },
                });
                return updatedCompleted;
            });
            await persistExerciseNotes(workoutLog.id);
            if (emitCompletionSideEffects) {
                await maybeNotifyCoach(workoutLog);
                triggerAchievementSync(subjectUserId);
            }
            return NextResponse.json(workoutLog, { status: 200 });
        }
        await prisma.logSet.deleteMany({ where: { workoutLogId: existingInProgress.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingInProgress.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        await persistExerciseNotes(workoutLog.id);
        if (emitCompletionSideEffects) {
            await maybeNotifyCoach(workoutLog);
            triggerAchievementSync(subjectUserId);
        }
        return NextResponse.json(workoutLog, { status: 200 });
    }

    if (existingCompleted) {
        await prisma.logSet.deleteMany({ where: { workoutLogId: existingCompleted.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingCompleted.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        await persistExerciseNotes(workoutLog.id);
        if (emitCompletionSideEffects) {
            await maybeNotifyCoach(workoutLog);
            triggerAchievementSync(subjectUserId);
        }
        return NextResponse.json(workoutLog, { status: 200 });
    }

    if (existingInProgress) {
        // Idempotent Start Workout: resume the existing session instead of wiping sets
        // when the client posts an empty placeholder payload again.
        const hasMeaningfulSets = setsWithRealIds.some((s) => incomingSetIsMeaningful(s));
        const applySetReplacement = shouldApplyInProgressSetReplacement({
            incomingHasMeaningfulSets: hasMeaningfulSets,
            expectedRevision,
            incomingExerciseIds: setsWithRealIds.map((s) => s.exerciseId),
            existingExerciseIds: existingInProgress.sets.map((s) => s.exerciseId),
        });
        if (status === "IN_PROGRESS" && !applySetReplacement) {
            const existing = await prisma.workoutLog.findUnique({
                where: { id: existingInProgress.id },
                include: {
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
                                    muscleGroup: true,
                                },
                            },
                        },
                        orderBy: logSetDisplayOrderBy,
                    },
                    workout: { select: { name: true } },
                },
            });
            return NextResponse.json(existing ?? existingInProgress, { status: 200 });
        }

        await prisma.logSet.deleteMany({ where: { workoutLogId: existingInProgress.id } });
        const workoutLog = await prisma.workoutLog.update({
            where: { id: existingInProgress.id },
            data: { ...logPayload, sets: { create: setsCreate } },
            include: { sets: true, workout: { select: { name: true } } },
        });
        await persistExerciseNotes(workoutLog.id);
        return NextResponse.json(workoutLog, { status: 200 });
    }

    let workoutLog;
    try {
        workoutLog = await prisma.workoutLog.create({
            data: {
                userId: subjectUserId,
                workoutId,
                ...logPayload,
                sets: { create: setsCreate },
            },
            include: { sets: true, workout: { select: { name: true } } },
        });
    } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (status === "IN_PROGRESS" && code === "P2002") {
            const existing = await getActiveWorkoutSession(subjectUserId);
            if (existing) {
                const current = await prisma.workoutLog.findUnique({
                    where: { id: existing.id },
                    include: { sets: true, workout: { select: { name: true } } },
                });
                return NextResponse.json(current ?? existing, { status: 200 });
            }
        }
        throw error;
    }

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

    await persistExerciseNotes(workoutLog.id);
    if (emitCompletionSideEffects) {
        await maybeNotifyCoach(workoutLog);
        triggerAchievementSync(subjectUserId);
    }

    return NextResponse.json(workoutLog, { status: 201 });
}

// GET recent logs or active session
export async function GET(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

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
                orderBy: logSetDisplayOrderBy,
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

        const session = await getActiveWorkoutSession(user.id);
        if (!session) return NextResponse.json(null);
        const activeLog = await prisma.workoutLog.findUnique({
            where: { id: session.id },
            include: activeInclude,
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
