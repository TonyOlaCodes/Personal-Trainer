import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateClientGoalTargets } from "@/lib/clientGoalTargets";
import { z } from "zod";
import { requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";

const goalsUpdateSchema = z.object({
    clientId: z.string().min(1),
    targetWeightKg: z.number().nullable().optional(),
    targetCalories: z.number().nullable().optional(),
    targetSteps: z.number().nullable().optional(),
    targetSleepHours: z.number().nullable().optional(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;

    try {
        const body = await req.json();
        const parsed = goalsUpdateSchema.parse(body);

        const editCheck = await requireCoachCanEditClient(coach, parsed.clientId);
        if (editCheck.error) return editCheck.error;

        const client = await prisma.user.findUnique({ where: { id: parsed.clientId } });
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        await updateClientGoalTargets(client.id, {
            ...(parsed.targetWeightKg !== undefined ? { targetWeightKg: parsed.targetWeightKg } : {}),
            ...(parsed.targetCalories !== undefined ? { targetCalories: parsed.targetCalories } : {}),
            ...(parsed.targetSteps !== undefined ? { targetSteps: parsed.targetSteps } : {}),
            ...(parsed.targetSleepHours !== undefined ? { targetSleepHours: parsed.targetSleepHours } : {}),
        });

        return NextResponse.json({ success: true, userId: client.id });
    } catch (err: unknown) {
        console.error("[Coach Goals API Error]:", err);
        const message = err instanceof Error ? err.message : "Failed to update client goals";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
