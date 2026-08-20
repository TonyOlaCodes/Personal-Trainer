import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import {
    deleteSessionOverride,
    getSessionOverride,
    upsertSessionOverride,
} from "@/lib/workoutSessionOverrides";

const exerciseSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    sets: z.number().int().min(1).max(50),
    reps: z.string().min(1),
    order: z.number().int().optional(),
    weightTargetKg: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
});

const upsertSchema = z.object({
    clientId: z.string().min(1),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseWorkoutId: z.string().min(1),
    workoutName: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    exercises: z.array(exerciseSchema).min(1),
});

const deleteSchema = z.object({
    clientId: z.string().min(1),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseWorkoutId: z.string().min(1),
});

async function requireCoach() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { coach };
}

/** Load one session override for a client date/workout. */
export async function GET(req: Request) {
    const authResult = await requireCoach();
    if (authResult.error) return authResult.error;

    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") ?? "";
    const dateKey = url.searchParams.get("dateKey") ?? "";
    const baseWorkoutId = url.searchParams.get("baseWorkoutId") ?? "";
    if (!clientId || !dateKey || !baseWorkoutId) {
        return NextResponse.json({ error: "clientId, dateKey and baseWorkoutId are required" }, { status: 400 });
    }

    const editCheck = await requireCoachCanEditClient(authResult.coach, clientId);
    if (editCheck.error) return editCheck.error;

    const override = await getSessionOverride(clientId, dateKey, baseWorkoutId);
    return NextResponse.json({ override });
}

/** Create/update a one-off session override (does not change the recurring plan). */
export async function POST(req: Request) {
    const authResult = await requireCoach();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const editCheck = await requireCoachCanEditClient(authResult.coach, parsed.data.clientId);
    if (editCheck.error) return editCheck.error;

    const override = await upsertSessionOverride({
        userId: parsed.data.clientId,
        dateKey: parsed.data.dateKey,
        baseWorkoutId: parsed.data.baseWorkoutId,
        workoutName: parsed.data.workoutName ?? null,
        notes: parsed.data.notes ?? null,
        createdById: authResult.coach.id,
        exercises: parsed.data.exercises.map((ex, index) => ({
            id: ex.id ?? `ex-${index}`,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            order: ex.order ?? index,
            weightTargetKg: ex.weightTargetKg ?? null,
            notes: ex.notes ?? null,
        })),
    });

    return NextResponse.json({ override });
}

/** Remove a session override so the date falls back to the recurring plan. */
export async function DELETE(req: Request) {
    const authResult = await requireCoach();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const editCheck = await requireCoachCanEditClient(authResult.coach, parsed.data.clientId);
    if (editCheck.error) return editCheck.error;

    await deleteSessionOverride(
        parsed.data.clientId,
        parsed.data.dateKey,
        parsed.data.baseWorkoutId
    );

    return NextResponse.json({ ok: true });
}
