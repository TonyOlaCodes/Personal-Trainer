import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser, requireCoachCanEditClient } from "@/lib/apiAuth";
import {
    deleteSessionOverride,
    getSessionOverride,
    upsertSessionOverride,
} from "@/lib/workoutSessionOverrides";

const setTargetSchema = z.object({
    setNumber: z.number().int().min(1).max(50),
    weightKg: z.number().nullable().optional(),
    reps: z.number().nullable().optional(),
    durationSec: z.number().nullable().optional(),
    distanceMeters: z.number().nullable().optional(),
    heightCm: z.number().nullable().optional(),
    rpe: z.number().nullable().optional(),
    resistance: z.number().nullable().optional(),
    inclinePct: z.number().nullable().optional(),
});

const exerciseSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    sets: z.number().int().min(1).max(50),
    reps: z.string().min(1),
    order: z.number().int().optional(),
    weightTargetKg: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    setTargets: z.array(setTargetSchema).optional(),
});

const upsertSchema = z.object({
    /** When omitted, the authenticated user edits their own session. */
    clientId: z.string().min(1).optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseWorkoutId: z.string().min(1),
    workoutName: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    exercises: z.array(exerciseSchema).min(1),
});

const deleteSchema = z.object({
    clientId: z.string().min(1).optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseWorkoutId: z.string().min(1),
});

async function resolveSubjectUserId(
    actor: { id: string; role: string },
    clientId?: string
): Promise<{ subjectUserId: string } | { error: NextResponse }> {
    if (!clientId || clientId === actor.id) {
        return { subjectUserId: actor.id };
    }
    if (!["COACH", "SUPER_ADMIN"].includes(actor.role)) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    const editCheck = await requireCoachCanEditClient(
        { id: actor.id, role: actor.role as "COACH" | "SUPER_ADMIN" | "FREE" | "PREMIUM" | "GENERAL_PREMIUM" },
        clientId
    );
    if (editCheck.error) return { error: editCheck.error };
    return { subjectUserId: clientId };
}

/** Load one session override for a date/workout. */
export async function GET(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const actor = authResult.user;

    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const dateKey = url.searchParams.get("dateKey") ?? "";
    const baseWorkoutId = url.searchParams.get("baseWorkoutId") ?? "";
    if (!dateKey || !baseWorkoutId) {
        return NextResponse.json({ error: "dateKey and baseWorkoutId are required" }, { status: 400 });
    }

    const subject = await resolveSubjectUserId(actor, clientId);
    if ("error" in subject) return subject.error;

    const override = await getSessionOverride(subject.subjectUserId, dateKey, baseWorkoutId);
    return NextResponse.json({ override });
}

/** Create/update a one-off session override (does not change the recurring plan or start a workout). */
export async function POST(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const actor = authResult.user;

    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const subject = await resolveSubjectUserId(actor, parsed.data.clientId);
    if ("error" in subject) return subject.error;

    const override = await upsertSessionOverride({
        userId: subject.subjectUserId,
        dateKey: parsed.data.dateKey,
        baseWorkoutId: parsed.data.baseWorkoutId,
        workoutName: parsed.data.workoutName ?? null,
        notes: parsed.data.notes ?? null,
        createdById: actor.id,
        exercises: parsed.data.exercises.map((ex, index) => ({
            id: ex.id ?? `ex-${index}`,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            order: ex.order ?? index,
            weightTargetKg: ex.weightTargetKg ?? null,
            notes: ex.notes ?? null,
            setTargets: ex.setTargets,
        })),
    });

    return NextResponse.json({ override });
}

/** Remove a session override so the date falls back to the recurring plan. */
export async function DELETE(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const actor = authResult.user;

    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const subject = await resolveSubjectUserId(actor, parsed.data.clientId);
    if ("error" in subject) return subject.error;

    await deleteSessionOverride(
        subject.subjectUserId,
        parsed.data.dateKey,
        parsed.data.baseWorkoutId
    );

    return NextResponse.json({ ok: true });
}
