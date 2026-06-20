import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCalories, normalizeSleepHours, normalizeSteps, updateDailyMetricTargets } from "@/lib/dailyMetrics";
import { z } from "zod";
import { requireCoachCanEditClient } from "@/lib/apiAuth";

const goalsUpdateSchema = z.object({
    clientId: z.string().min(1),
    targetWeightKg: z.number().nullable().optional(),
    targetCalories: z.number().nullable().optional(),
    targetSteps: z.number().nullable().optional(),
    targetSleepHours: z.number().nullable().optional(),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = goalsUpdateSchema.parse(body);

        const editCheck = await requireCoachCanEditClient(coach, parsed.clientId);
        if (editCheck.error) return editCheck.error;

        const client = await prisma.user.findUnique({ where: { id: parsed.clientId } });
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        // Update target weight on the client
        const updateData: any = {};
        if (parsed.targetWeightKg !== undefined) {
            updateData.targetWeightKg = parsed.targetWeightKg ? Math.round(parsed.targetWeightKg * 100) / 100 : null;
        }

        const updatedClient = await prisma.user.update({
            where: { id: parsed.clientId },
            data: updateData,
        });

        // Update metric targets
        if (
            parsed.targetCalories !== undefined ||
            parsed.targetSteps !== undefined ||
            parsed.targetSleepHours !== undefined
        ) {
            await updateDailyMetricTargets(client.id, {
                targetCalories: parsed.targetCalories !== undefined ? normalizeCalories(parsed.targetCalories) : null,
                targetSteps: parsed.targetSteps !== undefined ? normalizeSteps(parsed.targetSteps) : null,
                targetSleepHours: parsed.targetSleepHours !== undefined ? normalizeSleepHours(parsed.targetSleepHours) : null,
            });
        }

        return NextResponse.json({ success: true, userId: client.id });
    } catch (err: unknown) {
        console.error("[Coach Goals API Error]:", err);
        const message = err instanceof Error ? err.message : "Failed to update client goals";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
